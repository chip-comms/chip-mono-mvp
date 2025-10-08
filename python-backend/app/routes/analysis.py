"""
Meeting analysis endpoint that orchestrates the full AI pipeline.
This endpoint handles the complete sequence from video download to result storage.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any, Optional
import tempfile
import os
import asyncio
from pathlib import Path
import ffmpeg

# Import existing services
from app.services.supabase_client import SupabaseClient
from app.routes.audio import get_transcription_service

router = APIRouter()


class AnalysisMeetingRequest(BaseModel):
    videoUrl: str
    jobId: str


@router.post("/analyze-meeting")
async def analyze_meeting(request: AnalysisMeetingRequest, background_tasks: BackgroundTasks):
    """Complete meeting analysis pipeline matching the sequence diagram."""
    
    # Add the actual processing to background tasks for immediate response
    background_tasks.add_task(process_meeting_analysis, request.videoUrl, request.jobId)
    
    return {"success": True, "jobId": request.jobId, "status": "processing"}


async def process_meeting_analysis(video_url: str, job_id: str):
    """Background task to process the meeting analysis"""
    supabase = SupabaseClient()
    temp_files = []  # Track temp files for cleanup
    
    try:
        # Step 1: Download video from Supabase Storage
        print(f"[{job_id}] Starting analysis - downloading video from {video_url}")
        video_content = await supabase.download_file(video_url)
        
        # Save video to temp file
        temp_video = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
        temp_video.write(video_content)
        temp_video.close()
        temp_files.append(temp_video.name)
        print(f"[{job_id}] Video downloaded and saved to temp file")
        
        # Step 2: Extract audio from video (reuse existing functionality)
        temp_audio = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_audio.close()
        temp_files.append(temp_audio.name)
        
        print(f"[{job_id}] Extracting audio...")
        # Use ffmpeg to extract audio (reusing existing video processing logic)
        try:
            ffmpeg.input(temp_video.name).output(
                temp_audio.name,
                acodec="pcm_s16le",
                ac=1,  # Mono
                ar="16000",  # 16kHz sample rate
            ).overwrite_output().run(capture_stdout=True, capture_stderr=True)
        except ffmpeg.Error as e:
            raise Exception(f"Audio extraction failed: {e}")
        
        print(f"[{job_id}] Audio extracted successfully")
        
        # Step 3: Transcribe audio (reuse existing transcription service)
        print(f"[{job_id}] Starting transcription...")
        transcription_service = get_transcription_service()
        transcript_result = transcription_service.transcribe_with_words(
            Path(temp_audio.name)
        )
        print(f"[{job_id}] Transcription completed")
        
        # Step 4: Perform video analysis (placeholder for now)
        print(f"[{job_id}] Performing video analysis...")
        video_metrics = await analyze_video_content(temp_video.name)
        
        # Step 5: Calculate communication metrics
        print(f"[{job_id}] Calculating communication metrics...")
        communication_metrics = calculate_communication_metrics(transcript_result)
        
        # Step 6: LLM Analysis for insights
        print(f"[{job_id}] Performing LLM analysis...")
        llm_insights = await perform_llm_analysis(transcript_result)
        
        # Step 7: Combine all results
        final_results = {
            "transcript": transcript_result,
            "video_metrics": video_metrics,
            "communication_metrics": communication_metrics,
            **llm_insights  # Includes summary, action_items, key_topics, sentiment
        }
        
        # Step 8: Save results back to Supabase
        print(f"[{job_id}] Saving results to database...")
        await supabase.save_analysis_results(job_id, final_results)
        
        # Step 9: Update job status to completed
        await supabase.update_job_status(job_id, "completed")
        print(f"[{job_id}] Analysis completed successfully!")
        
    except Exception as e:
        print(f"[{job_id}] Error during analysis: {e}")
        # Update job status to failed in Supabase
        await supabase.update_job_status(job_id, "failed", str(e))
        raise
    
    finally:
        # Cleanup temporary files
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except Exception as cleanup_error:
                print(f"[{job_id}] Warning: Failed to cleanup {temp_file}: {cleanup_error}")


async def analyze_video_content(video_path: str) -> Dict[str, Any]:
    """
    Placeholder for video analysis (face detection, eye tracking, etc.)
    This would integrate with existing computer vision capabilities
    """
    # For now, return placeholder metrics
    # In the future, this would use actual video analysis
    return {
        "eye_contact_percentage": 0.75,  # Placeholder
        "face_detection_confidence": 0.92,
        "gaze_analysis": {"focused": 0.68, "distracted": 0.32},
        "speaker_visibility": 0.85,
        "video_quality_score": 0.88
    }


def calculate_communication_metrics(transcript_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate communication metrics from transcript.
    This implements logic similar to what was in supabase-backend/lib/ai/metrics.ts
    """
    
    # Get segments and calculate basic metrics
    segments = transcript_result.get('segments', [])
    if not segments:
        return {
            "talk_time_percentage": 0,
            "interruptions": 0,
            "average_response_delay": 0,
            "speaker_breakdown": []
        }
    
    # Group segments by speaker
    speaker_stats = {}
    total_duration = transcript_result.get('duration', 0)
    
    for segment in segments:
        speaker = segment.get('speaker', 'Unknown')
        duration = segment.get('end', 0) - segment.get('start', 0)
        word_count = len(segment.get('text', '').split())
        
        if speaker not in speaker_stats:
            speaker_stats[speaker] = {
                'duration': 0,
                'word_count': 0,
                'segment_count': 0
            }
        
        speaker_stats[speaker]['duration'] += duration
        speaker_stats[speaker]['word_count'] += word_count
        speaker_stats[speaker]['segment_count'] += 1
    
    # Calculate speaker breakdown
    speaker_breakdown = []
    for speaker, stats in speaker_stats.items():
        percentage = (stats['duration'] / total_duration) if total_duration > 0 else 0
        speaker_breakdown.append({
            "speaker": speaker,
            "duration": stats['duration'],
            "word_count": stats['word_count'],
            "percentage": percentage
        })
    
    # Calculate basic metrics
    primary_speaker = max(speaker_breakdown, key=lambda x: x['percentage']) if speaker_breakdown else None
    talk_time_percentage = primary_speaker['percentage'] if primary_speaker else 0
    
    # Simple interruption detection (placeholder)
    interruptions = max(0, len(segments) - len(speaker_stats)) // 2
    
    # Average response delay (placeholder - would need more sophisticated analysis)
    average_response_delay = 1.2  # seconds
    
    return {
        "talk_time_percentage": talk_time_percentage,
        "interruptions": interruptions,
        "average_response_delay": average_response_delay,
        "speaker_breakdown": speaker_breakdown,
        "total_speakers": len(speaker_stats),
        "total_segments": len(segments)
    }


async def perform_llm_analysis(transcript_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform LLM analysis for summary, action items, etc.
    This implements the logic that was in supabase-backend/lib/ai/analysis.ts
    """
    
    # Extract full text from transcript
    full_text = transcript_result.get('text', '')
    if not full_text.strip():
        return {
            "summary": "No transcript available for analysis",
            "action_items": [],
            "key_topics": [],
            "sentiment": {"overall": "neutral", "score": 0.0}
        }
    
    # For now, return placeholder results
    # In the future, this would use the Gemini API or OpenAI API
    # to analyze the transcript and generate insights
    
    try:
        # This is where we would call the actual LLM API
        # For example, using the Gemini API that's configured in the environment
        
        return {
            "summary": f"Meeting analysis from {len(full_text.split())} words of transcript. Key discussion points identified and participant engagement analyzed.",
            "action_items": [
                {"text": "Follow up on project timeline", "priority": "high"},
                {"text": "Schedule next team sync", "priority": "medium"},
                {"text": "Review meeting objectives", "priority": "low"}
            ],
            "key_topics": [
                {"topic": "Project Planning", "relevance": 0.9},
                {"topic": "Team Coordination", "relevance": 0.7},
                {"topic": "Progress Review", "relevance": 0.6}
            ],
            "sentiment": {
                "overall": "positive",
                "score": 0.7
            }
        }
        
    except Exception as e:
        print(f"LLM analysis failed: {e}")
        return {
            "summary": "Analysis completed with basic metrics",
            "action_items": [],
            "key_topics": [],
            "sentiment": {"overall": "neutral", "score": 0.0}
        }


@router.get("/health")
async def analysis_health_check():
    """Health check for analysis service"""
    try:
        # Test Supabase connection
        supabase = SupabaseClient()
        
        # Test transcription service
        transcription_service = get_transcription_service()
        
        return {
            "success": True,
            "service": "analysis",
            "supabase_configured": bool(supabase.url and supabase.service_key),
            "transcription_available": True,
            "model_size": transcription_service.model_size,
            "device": transcription_service.device
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }