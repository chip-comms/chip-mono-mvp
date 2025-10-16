"""
Audio processing endpoints.

Handles audio transcription and analysis.
"""

import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse

from app.services.audio.transcription import TranscriptionService

router = APIRouter()

# Initialize transcription service (lazy loading)
_transcription_service: Optional[TranscriptionService] = None


def get_transcription_service() -> TranscriptionService:
    """Get or create transcription service instance."""
    global _transcription_service
    if _transcription_service is None:
        _transcription_service = TranscriptionService(
            model_name="base.en"  # Fast and accurate for English
        )
    return _transcription_service


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    enable_word_timestamps: bool = Form(True)
):
    """
    Transcribe audio file using WhisperX.

    Args:
        file: Audio file (wav, mp3, m4a, etc.)
        language: Language code (e.g. 'en', 'es') or None for auto-detect
        enable_word_timestamps: Whether to include word-level timestamps

    Returns:
        JSON with:
            - text: Full transcript
            - segments: List of segments with timestamps
            - language: Detected/specified language
            - duration: Audio duration in seconds
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Validate file type
    allowed_extensions = ['.wav', '.mp3', '.m4a', '.mp4', '.flac', '.ogg']
    file_ext = Path(file.filename).suffix.lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
        )

    # Save uploaded file temporarily
    temp_audio = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext)

    try:
        # Write uploaded file to temp location
        content = await file.read()
        temp_audio.write(content)
        temp_audio.close()

        # Get transcription service
        service = get_transcription_service()

        # Transcribe
        if enable_word_timestamps:
            result = service.transcribe_with_words(
                Path(temp_audio.name),
                language=language
            )
        else:
            result = service.transcribe(
                Path(temp_audio.name),
                language=language
            )

        return JSONResponse(content={
            "success": True,
            **result
        })

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}"
        )

    finally:
        # Cleanup temp file
        if os.path.exists(temp_audio.name):
            os.unlink(temp_audio.name)


@router.get("/languages")
async def get_supported_languages():
    """
    Get list of supported languages for transcription.

    Returns:
        JSON with list of language codes
    """
    service = get_transcription_service()
    languages = service.get_supported_languages()

    return {
        "success": True,
        "languages": languages,
        "total": len(languages)
    }


@router.get("/health")
async def audio_health_check():
    """Check if audio processing services are available."""
    try:
        # Try to initialize service (doesn't load model yet)
        service = get_transcription_service()

        return {
            "success": True,
            "service": "audio-processing",
            "transcription_available": True,
            "model_size": service.model_size,
            "device": service.device
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
