"""
Process endpoint for handling video/audio processing jobs from Next.js frontend.
"""

import sys
import tempfile
import httpx
import logging
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.services.supabase_client import SupabaseClient
from app.services.audio.transcription import TranscriptionService
from app.services.llm.llm_adapter import LLMAdapter

# Configure logging to output to stdout with immediate flush
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)
logger = logging.getLogger(__name__)
# Force flush after every log message
for handler in logger.handlers:
    handler.setLevel(logging.INFO)
    if hasattr(handler, "setFormatter"):
        handler.setFormatter(
            logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
        )

router = APIRouter()


class ProcessJobRequest(BaseModel):
    """Request model for processing a job"""

    job_id: str
    user_id: str
    file_url: str
    original_filename: str
    storage_path: str


class ProcessJobResponse(BaseModel):
    """Response model for processing job"""

    success: bool
    message: str
    python_job_id: str
    job_id: str


async def download_file(url: str, destination: Path) -> None:
    """Download file from URL to destination path"""
    async with httpx.AsyncClient(timeout=600.0) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            with open(destination, "wb") as f:
                async for chunk in response.aiter_bytes(chunk_size=8192):
                    f.write(chunk)


def calculate_per_speaker_response_latency(
    segments: list[Dict[str, Any]]
) -> Dict[str, Dict[str, Any]]:
    """
    Calculate response latency metrics per speaker.

    Args:
        segments: List of transcription segments with start, end, and speaker

    Returns:
        Dictionary mapping speaker to their response latency metrics:
            - average_seconds: Average gap before this speaker responds
            - response_count: Number of times this speaker responded
            - quick_responses_count: Number of responses < 1 second
            - quick_responses_percentage: Percentage of quick responses
    """
    if len(segments) < 2:
        return {}

    speaker_gaps: Dict[str, list[float]] = {}
    prev_speaker = None
    prev_end = None

    for segment in segments:
        current_speaker = segment.get("speaker")
        current_start = segment.get("start", 0)

        # Calculate gap if speaker changed
        if prev_speaker and prev_end is not None and prev_speaker != current_speaker:
            gap = current_start - prev_end
            if gap >= 0:  # Only count positive gaps
                # This gap belongs to the current speaker (who is responding)
                if current_speaker not in speaker_gaps:
                    speaker_gaps[current_speaker] = []
                speaker_gaps[current_speaker].append(gap)

        prev_speaker = current_speaker
        prev_end = segment.get("end", 0)

    # Calculate metrics for each speaker
    result = {}
    for speaker, gaps in speaker_gaps.items():
        if not gaps:
            continue

        average_gap = sum(gaps) / len(gaps)
        quick_responses = [g for g in gaps if g < 1.0]
        quick_percentage = (len(quick_responses) / len(gaps) * 100)

        result[speaker] = {
            "average_seconds": round(average_gap, 2),
            "response_count": len(gaps),
            "quick_responses_count": len(quick_responses),
            "quick_responses_percentage": round(quick_percentage, 1),
        }

    return result


def calculate_per_speaker_interruptions(
    segments: list[Dict[str, Any]]
) -> Dict[str, Dict[str, Any]]:
    """
    Calculate interruption metrics per speaker.

    Args:
        segments: List of transcription segments with start, end, and speaker

    Returns:
        Dictionary mapping speaker to their interruption metrics:
            - times_interrupted: Times this speaker was interrupted
            - times_interrupting: Times this speaker interrupted others
            - interruption_rate: Interruptions per minute of their talk time
    """
    if len(segments) < 2:
        return {}

    speaker_interruptions: Dict[str, Dict[str, Any]] = {}
    speaker_talk_time: Dict[str, float] = {}

    # Initialize speaker metrics
    for seg in segments:
        speaker = seg.get("speaker")
        if speaker not in speaker_interruptions:
            speaker_interruptions[speaker] = {
                "times_interrupted": 0,
                "times_interrupting": 0,
            }
            speaker_talk_time[speaker] = 0.0

        # Track talk time
        duration = seg.get("end", 0) - seg.get("start", 0)
        speaker_talk_time[speaker] += duration

    # Detect interruptions
    for i, seg1 in enumerate(segments):
        speaker1 = seg1.get("speaker")
        start1 = seg1.get("start", 0)
        end1 = seg1.get("end", 0)

        for seg2 in segments[i + 1:]:
            speaker2 = seg2.get("speaker")
            start2 = seg2.get("start", 0)
            end2 = seg2.get("end", 0)

            # Check if different speakers and overlapping time
            if speaker1 != speaker2:
                overlap_start = max(start1, start2)
                overlap_end = min(end1, end2)

                if overlap_start < overlap_end:
                    # speaker2 interrupted speaker1
                    speaker_interruptions[speaker1]["times_interrupted"] += 1
                    speaker_interruptions[speaker2]["times_interrupting"] += 1

    # Calculate interruption rates
    result = {}
    for speaker, metrics in speaker_interruptions.items():
        talk_time_minutes = speaker_talk_time[speaker] / 60
        interruption_rate = 0.0
        if talk_time_minutes > 0:
            total_interruptions = (
                metrics["times_interrupted"] + metrics["times_interrupting"]
            )
            interruption_rate = total_interruptions / talk_time_minutes

        result[speaker] = {
            "times_interrupted": metrics["times_interrupted"],
            "times_interrupting": metrics["times_interrupting"],
            "interruption_rate": round(interruption_rate, 2),
        }

    return result


async def process_job_task(
    job_id: str,
    user_id: str,
    file_url: str,
    original_filename: str,
) -> None:
    """
    Background task to process the video/audio file.
    This runs asynchronously after the API returns.
    """
    supabase = SupabaseClient()
    temp_file = None

    try:
        # Create temp directory for this job
        temp_dir = Path(tempfile.mkdtemp(prefix=f"job_{job_id}_"))
        temp_file = temp_dir / original_filename

        logger.info(f"[Job {job_id}] Downloading file from: {file_url[:50]}...")
        sys.stdout.flush()

        # Download file from signed URL
        await download_file(file_url, temp_file)

        file_size_mb = temp_file.stat().st_size / (1024 * 1024)
        logger.info(f"[Job {job_id}] Downloaded {file_size_mb:.2f} MB")
        sys.stdout.flush()

        # Step 1: Transcribe audio (with speaker diarization)
        logger.info(
            f"[Job {job_id}] Starting transcription with speaker diarization..."
        )
        sys.stdout.flush()
        transcription_service = TranscriptionService()
        transcription_result = await transcription_service.transcribe(temp_file)

        if not transcription_result or "error" in transcription_result:
            error_msg = transcription_result.get("error", "Unknown error")
            raise Exception(f"Transcription failed: {error_msg}")

        num_speakers = transcription_result.get("num_speakers", 0)
        num_segments = len(transcription_result.get("segments", []))
        logger.info(
            f"[Job {job_id}] Transcription complete. "
            f"Speakers: {num_speakers}, Segments: {num_segments}"
        )
        sys.stdout.flush()

        # Step 2: Calculate speaker statistics first
        logger.info(f"[Job {job_id}] Calculating speaker statistics...")
        sys.stdout.flush()
        segments = transcription_result.get("segments", [])
        speaker_stats: Dict[str, Any] = {}

        for segment in segments:
            speaker = segment.get("speaker", "Unknown")
            if speaker not in speaker_stats:
                speaker_stats[speaker] = {
                    "total_time": 0,
                    "word_count": 0,
                    "segments": 0,
                }

            speaker_stats[speaker]["total_time"] += segment.get("end", 0) - segment.get(
                "start", 0
            )
            speaker_stats[speaker]["word_count"] += len(segment.get("text", "").split())
            speaker_stats[speaker]["segments"] += 1

        # Calculate percentages
        total_time = sum(stats["total_time"] for stats in speaker_stats.values())
        for speaker, stats in speaker_stats.items():
            if total_time > 0:
                percentage = round((stats["total_time"] / total_time * 100), 1)
            else:
                percentage = 0
            stats["percentage"] = percentage
            stats["total_time"] = round(stats["total_time"], 2)

        logger.info(f"[Job {job_id}] Speaker statistics calculated")
        sys.stdout.flush()

        # Step 3: Calculate per-speaker communication metrics
        logger.info(f"[Job {job_id}] Calculating per-speaker metrics...")
        sys.stdout.flush()

        # Calculate per-speaker response latency
        per_speaker_latency = calculate_per_speaker_response_latency(segments)

        # Calculate per-speaker interruptions
        per_speaker_interruptions = calculate_per_speaker_interruptions(segments)

        # Merge metrics into speaker_stats
        for speaker, stats in speaker_stats.items():
            # Add response latency metrics
            latency_metrics = per_speaker_latency.get(speaker, {})
            stats["response_latency"] = latency_metrics.get("average_seconds", 0.0)
            stats["response_count"] = latency_metrics.get("response_count", 0)
            stats["quick_responses_percentage"] = latency_metrics.get(
                "quick_responses_percentage", 0.0
            )

            # Add interruption metrics
            interruption_metrics = per_speaker_interruptions.get(speaker, {})
            stats["times_interrupted"] = interruption_metrics.get(
                "times_interrupted", 0
            )
            stats["times_interrupting"] = interruption_metrics.get(
                "times_interrupting", 0
            )
            stats["interruption_rate"] = interruption_metrics.get(
                "interruption_rate", 0.0
            )

        logger.info(f"[Job {job_id}] Per-speaker metrics calculated")
        sys.stdout.flush()

        # Step 4: Generate per-speaker communication tips using LLM
        logger.info(
            f"[Job {job_id}] Generating communication tips for each speaker..."
        )
        sys.stdout.flush()

        llm_adapter = LLMAdapter()
        meeting_duration_minutes = transcription_result.get("duration", 0) / 60

        # Generate tips for each speaker
        for speaker, stats in speaker_stats.items():
            try:
                provider = await llm_adapter.get_provider()
                tips = await provider.generate_speaker_communication_tips(
                    speaker_label=speaker,
                    talk_time_percentage=stats["percentage"],
                    word_count=stats["word_count"],
                    segments_count=stats["segments"],
                    avg_response_latency=stats.get("response_latency", 0.0),
                    times_interrupted=stats.get("times_interrupted", 0),
                    times_interrupting=stats.get("times_interrupting", 0),
                    total_speakers=len(speaker_stats),
                    meeting_duration_minutes=meeting_duration_minutes,
                )
                stats["communication_tips"] = tips
                logger.info(
                    f"[Job {job_id}] Generated {len(tips)} tips for {speaker}"
                )
            except Exception as tip_error:
                logger.warning(
                    f"[Job {job_id}] Failed to generate tips for {speaker}: "
                    f"{str(tip_error)}"
                )
                stats["communication_tips"] = [
                    "Focus on balanced participation in meetings.",
                    "Practice active listening and timely responses.",
                ]

        sys.stdout.flush()

        # Step 5: Save results to database
        logger.info(f"[Job {job_id}] Saving analysis to database...")
        sys.stdout.flush()

        analysis_record = {
            "job_id": job_id,
            "user_id": user_id,
            "transcript": transcription_result,
            "summary": None,  # No longer using LLM-generated meeting summary
            # speaker_stats now includes all per-speaker metrics:
            # - total_time, word_count, segments, percentage
            # - response_latency, response_count, quick_responses_percentage
            # - times_interrupted, times_interrupting, interruption_rate
            # - communication_tips
            "speaker_stats": speaker_stats,
            "communication_metrics": None,  # Metrics now per-speaker
            # Can be populated later with video analysis
            "behavioral_insights": None,
        }

        await supabase.save_analysis_results(job_id, analysis_record)
        logger.info(f"[Job {job_id}] Analysis saved to database")
        sys.stdout.flush()

        # Update job status to completed
        await supabase.update_job_status(job_id, "completed")
        logger.info(f"[Job {job_id}] Job status updated to 'completed'")
        sys.stdout.flush()

        logger.info(f"[Job {job_id}] ✅ PROCESSING COMPLETE!")
        sys.stdout.flush()

    except Exception as e:
        logger.error(f"[Job {job_id}] ❌ ERROR during processing: {str(e)}")
        sys.stdout.flush()

        # Update job status to failed
        try:
            await supabase.update_job_status(job_id, "failed", str(e))
            logger.info(f"[Job {job_id}] Job status updated to 'failed'")
            sys.stdout.flush()
        except Exception as update_error:
            logger.error(
                f"[Job {job_id}] Failed to update error status: {str(update_error)}"
            )
            sys.stdout.flush()

    finally:
        # Cleanup temp file
        if temp_file and temp_file.exists():
            try:
                temp_file.unlink()
                if temp_file.parent.exists():
                    temp_file.parent.rmdir()
                logger.info(f"[Job {job_id}] Cleaned up temp files")
                sys.stdout.flush()
            except Exception as cleanup_error:
                logger.error(f"[Job {job_id}] Cleanup error: {str(cleanup_error)}")
                sys.stdout.flush()


@router.post("/process", response_model=ProcessJobResponse)
async def process_job(
    request: ProcessJobRequest, background_tasks: BackgroundTasks
) -> ProcessJobResponse:
    """
    Start processing a video/audio file.

    This endpoint receives a job request from Next.js, validates it,
    and starts the processing in the background.

    Note: Authentication is handled by APIKeyMiddleware
    """

    # Validate request
    if not request.job_id or not request.file_url:
        raise HTTPException(status_code=400, detail="job_id and file_url are required")

    logger.info(f"📥 Received processing request for job: {request.job_id}")
    sys.stdout.flush()

    # Generate Python job ID (for tracking within Python backend)
    python_job_id = f"py_{request.job_id}"

    # Start processing in background
    background_tasks.add_task(
        process_job_task,
        request.job_id,
        request.user_id,
        request.file_url,
        request.original_filename,
    )

    return ProcessJobResponse(
        success=True,
        message="Processing started",
        python_job_id=python_job_id,
        job_id=request.job_id,
    )


@router.get("/process/status/{job_id}")
async def get_job_status(job_id: str) -> Dict[str, Any]:
    """
    Get the current status of a processing job.

    This queries the Supabase database for job status.
    """
    try:
        supabase = SupabaseClient()
        job = await supabase.get_job_status(job_id)

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        return {"success": True, "job": job}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching job status: {str(e)}")
        sys.stdout.flush()
        raise HTTPException(status_code=500, detail=str(e))
