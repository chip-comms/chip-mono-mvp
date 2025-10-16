"""
Process endpoint for handling video/audio processing jobs from Next.js frontend.
"""

import os
import sys
import asyncio
import tempfile
import httpx
import logging
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel

from app.services.supabase_client import SupabaseClient
from app.services.audio.transcription import TranscriptionService
from app.services.llm.llm_adapter import LLMAdapter

# Configure logging to output to stdout with immediate flush
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ],
    force=True
)
logger = logging.getLogger(__name__)
# Force flush after every log message
for handler in logger.handlers:
    handler.setLevel(logging.INFO)
    if hasattr(handler, 'setFormatter'):
        handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))

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
        async with client.stream('GET', url) as response:
            response.raise_for_status()
            with open(destination, 'wb') as f:
                async for chunk in response.aiter_bytes(chunk_size=8192):
                    f.write(chunk)


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

        # Step 1: Transcribe audio
        logger.info(f"[Job {job_id}] Starting transcription...")
        sys.stdout.flush()
        transcription_service = TranscriptionService()
        transcription_result = transcription_service.transcribe(temp_file)

        if not transcription_result or 'error' in transcription_result:
            raise Exception(f"Transcription failed: {transcription_result.get('error', 'Unknown error')}")

        logger.info(f"[Job {job_id}] Transcription complete. Segments: {len(transcription_result.get('segments', []))}")
        sys.stdout.flush()

        # Step 2: Generate AI analysis
        logger.info(f"[Job {job_id}] Starting AI analysis...")
        sys.stdout.flush()
        llm_adapter = LLMAdapter()

        # Generate summary and insights from transcript
        transcript_text = transcription_result.get('text', '')

        # Use the analyze_transcript method from LLM adapter
        try:
            analysis_result = await llm_adapter.analyze_transcript(transcript_text)

            # Convert AnalysisResult to dict format expected by database
            analysis_data = {
                "summary": analysis_result.summary,
                "key_topics": [topic.topic for topic in analysis_result.key_topics] if analysis_result.key_topics else [],
                "action_items": [
                    {"text": item.text, "priority": item.priority}
                    for item in analysis_result.action_items
                ] if analysis_result.action_items else [],
                "effectiveness_score": int(analysis_result.sentiment.score * 100) if analysis_result.sentiment else 50
            }
        except Exception as llm_error:
            logger.warning(f"[Job {job_id}] LLM analysis failed: {str(llm_error)}, using fallback")
            sys.stdout.flush()
            # Fallback analysis if LLM fails
            analysis_data = {
                "summary": f"Meeting transcript analyzed with {len(transcript_text.split())} words.",
                "key_topics": ["General Discussion"],
                "action_items": [],
                "effectiveness_score": 50
            }

        logger.info(f"[Job {job_id}] AI analysis complete")
        sys.stdout.flush()

        # Step 3: Calculate speaker statistics
        logger.info(f"[Job {job_id}] Calculating speaker statistics...")
        sys.stdout.flush()
        segments = transcription_result.get('segments', [])
        speaker_stats: Dict[str, Any] = {}

        for segment in segments:
            speaker = segment.get('speaker', 'Unknown')
            if speaker not in speaker_stats:
                speaker_stats[speaker] = {
                    'total_time': 0,
                    'word_count': 0,
                    'segments': 0
                }

            speaker_stats[speaker]['total_time'] += segment.get('end', 0) - segment.get('start', 0)
            speaker_stats[speaker]['word_count'] += len(segment.get('text', '').split())
            speaker_stats[speaker]['segments'] += 1

        # Calculate percentages
        total_time = sum(stats['total_time'] for stats in speaker_stats.values())
        for speaker, stats in speaker_stats.items():
            stats['percentage'] = (stats['total_time'] / total_time * 100) if total_time > 0 else 0

        logger.info(f"[Job {job_id}] Speaker stats calculated. Speakers: {len(speaker_stats)}")
        sys.stdout.flush()

        # Step 4: Save results to database
        logger.info(f"[Job {job_id}] Saving analysis to database...")
        sys.stdout.flush()

        analysis_record = {
            'job_id': job_id,
            'user_id': user_id,
            'transcript': transcription_result,
            'summary': analysis_data.get('summary'),
            'speaker_stats': speaker_stats,
            'communication_metrics': {
                'overall_score': analysis_data.get('effectiveness_score', 50),
                'key_topics': analysis_data.get('key_topics', []),
                'action_items': analysis_data.get('action_items', [])
            },
            'behavioral_insights': None  # Can be populated later with video analysis
        }

        await supabase.save_analysis_results(job_id, analysis_record)
        logger.info(f"[Job {job_id}] Analysis saved to database")
        sys.stdout.flush()

        # Update job status to completed
        await supabase.update_job_status(job_id, 'completed')
        logger.info(f"[Job {job_id}] Job status updated to 'completed'")
        sys.stdout.flush()

        logger.info(f"[Job {job_id}] ✅ PROCESSING COMPLETE!")
        sys.stdout.flush()

    except Exception as e:
        logger.error(f"[Job {job_id}] ❌ ERROR during processing: {str(e)}")
        sys.stdout.flush()

        # Update job status to failed
        try:
            await supabase.update_job_status(job_id, 'failed', str(e))
            logger.info(f"[Job {job_id}] Job status updated to 'failed'")
            sys.stdout.flush()
        except Exception as update_error:
            logger.error(f"[Job {job_id}] Failed to update error status: {str(update_error)}")
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
    request: ProcessJobRequest,
    background_tasks: BackgroundTasks
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
        request.original_filename
    )

    return ProcessJobResponse(
        success=True,
        message="Processing started",
        python_job_id=python_job_id,
        job_id=request.job_id
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

        return {
            "success": True,
            "job": job
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching job status: {str(e)}")
        sys.stdout.flush()
        raise HTTPException(status_code=500, detail=str(e))
