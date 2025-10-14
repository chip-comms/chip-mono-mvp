"""
Process endpoint for handling video/audio processing jobs from Next.js frontend.
"""

import os
import asyncio
import tempfile
import httpx
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel

from app.services.supabase_client import SupabaseClient
from app.services.audio.transcription import TranscriptionService
from app.services.llm.llm_adapter import LLMAdapter

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

        print(f"[Job {job_id}] Downloading file from: {file_url[:50]}...")

        # Download file from signed URL
        await download_file(file_url, temp_file)

        file_size_mb = temp_file.stat().st_size / (1024 * 1024)
        print(f"[Job {job_id}] Downloaded {file_size_mb:.2f} MB")

        # Step 1: Transcribe audio
        print(f"[Job {job_id}] Starting transcription...")
        transcription_service = TranscriptionService()
        transcription_result = transcription_service.transcribe(temp_file)

        if not transcription_result or 'error' in transcription_result:
            raise Exception(f"Transcription failed: {transcription_result.get('error', 'Unknown error')}")

        print(f"[Job {job_id}] Transcription complete. Segments: {len(transcription_result.get('segments', []))}")

        # Step 2: Generate AI analysis
        print(f"[Job {job_id}] Starting AI analysis...")
        llm_adapter = LLMAdapter()

        # Generate summary and insights from transcript
        transcript_text = transcription_result.get('text', '')

        # Create analysis prompt
        analysis_prompt = f"""Analyze this meeting transcript and provide:
1. A concise summary (2-3 paragraphs)
2. Key topics discussed
3. Action items identified
4. Overall meeting effectiveness

Transcript:
{transcript_text}

Provide your response in JSON format with keys: summary, key_topics (array), action_items (array), effectiveness_score (0-100)"""

        analysis_response = await llm_adapter.generate(analysis_prompt)

        # Parse AI response (this is simplified - you may want to add better parsing)
        import json
        try:
            analysis_data = json.loads(analysis_response)
        except json.JSONDecodeError:
            # Fallback if AI doesn't return valid JSON
            analysis_data = {
                "summary": analysis_response[:500],
                "key_topics": [],
                "action_items": [],
                "effectiveness_score": 50
            }

        print(f"[Job {job_id}] AI analysis complete")

        # Step 3: Calculate speaker statistics
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

        print(f"[Job {job_id}] Speaker stats calculated. Speakers: {len(speaker_stats)}")

        # Step 4: Save results to database
        print(f"[Job {job_id}] Saving analysis to database...")

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

        # Update job status to completed
        await supabase.update_job_status(job_id, 'completed')

        print(f"[Job {job_id}] Processing complete!")

    except Exception as e:
        print(f"[Job {job_id}] Error during processing: {str(e)}")

        # Update job status to failed
        try:
            await supabase.update_job_status(job_id, 'failed', str(e))
        except Exception as update_error:
            print(f"[Job {job_id}] Failed to update error status: {str(update_error)}")

    finally:
        # Cleanup temp file
        if temp_file and temp_file.exists():
            try:
                temp_file.unlink()
                if temp_file.parent.exists():
                    temp_file.parent.rmdir()
                print(f"[Job {job_id}] Cleaned up temp files")
            except Exception as cleanup_error:
                print(f"[Job {job_id}] Cleanup error: {str(cleanup_error)}")


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

    print(f"Received processing request for job: {request.job_id}")

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
        print(f"Error fetching job status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
