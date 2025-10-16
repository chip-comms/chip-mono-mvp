"""Video processing endpoints.

TODO (CHI-22): Re-enable when implementing real ML pipeline.
These endpoints require ffmpeg and PIL which are disabled for local development.
"""

import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import FileResponse
# import ffmpeg  # TODO (CHI-22): Re-enable for real ML pipeline
# from PIL import Image  # TODO (CHI-22): Re-enable for real ML pipeline

from app.config import settings

router = APIRouter()


@router.post("/extract-audio")
async def extract_audio(
    file: UploadFile = File(...),
    format: str = Form("wav")
):
    """
    Extract audio from video file.
    
    Returns the audio file in the specified format (wav, mp3, etc.)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Save uploaded file temporarily
    temp_video = tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix)
    try:
        content = await file.read()
        temp_video.write(content)
        temp_video.close()
        
        # Extract audio using ffmpeg
        output_path = temp_video.name.replace(Path(temp_video.name).suffix, f".{format}")
        
        try:
            ffmpeg.input(temp_video.name).output(
                output_path,
                acodec="pcm_s16le" if format == "wav" else "libmp3lame",
                ac=1,  # Mono
                ar="16000",  # 16kHz sample rate (good for speech recognition)
            ).overwrite_output().run(capture_stdout=True, capture_stderr=True)
        except ffmpeg.Error as e:
            raise HTTPException(
                status_code=500,
                detail=f"FFmpeg error: {e.stderr.decode()}"
            )
        
        # Return the audio file
        return FileResponse(
            output_path,
            media_type=f"audio/{format}",
            filename=f"audio.{format}",
        )
        
    finally:
        # Cleanup
        if os.path.exists(temp_video.name):
            os.unlink(temp_video.name)


@router.post("/thumbnail")
async def generate_thumbnail(
    file: UploadFile = File(...),
    timestamp: float = Form(0.0),
    width: int = Form(640),
    height: int = Form(360)
):
    """
    Generate a thumbnail from video at a specific timestamp.
    
    Args:
        file: Video file
        timestamp: Time in seconds to capture thumbnail (default: 0.0)
        width: Thumbnail width (default: 640)
        height: Thumbnail height (default: 360)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Save uploaded file temporarily
    temp_video = tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix)
    temp_image = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
    
    try:
        content = await file.read()
        temp_video.write(content)
        temp_video.close()
        temp_image.close()
        
        # Extract frame using ffmpeg
        try:
            ffmpeg.input(temp_video.name, ss=timestamp).filter(
                "scale", width, height
            ).output(
                temp_image.name, vframes=1
            ).overwrite_output().run(capture_stdout=True, capture_stderr=True)
        except ffmpeg.Error as e:
            raise HTTPException(
                status_code=500,
                detail=f"FFmpeg error: {e.stderr.decode()}"
            )
        
        # Return the thumbnail
        return FileResponse(
            temp_image.name,
            media_type="image/jpeg",
            filename="thumbnail.jpg",
        )
        
    finally:
        # Cleanup
        if os.path.exists(temp_video.name):
            os.unlink(temp_video.name)


@router.post("/info")
async def get_video_info(file: UploadFile = File(...)):
    """
    Get metadata about a video file.
    
    Returns duration, resolution, codec, bitrate, etc.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Save uploaded file temporarily
    temp_video = tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix)
    
    try:
        content = await file.read()
        temp_video.write(content)
        temp_video.close()
        
        # Get video info using ffmpeg
        try:
            probe = ffmpeg.probe(temp_video.name)
        except ffmpeg.Error as e:
            raise HTTPException(
                status_code=500,
                detail=f"FFmpeg error: {e.stderr.decode()}"
            )
        
        # Extract relevant information
        video_info = next(
            (s for s in probe["streams"] if s["codec_type"] == "video"),
            None
        )
        audio_info = next(
            (s for s in probe["streams"] if s["codec_type"] == "audio"),
            None
        )
        
        if not video_info:
            raise HTTPException(status_code=400, detail="No video stream found")
        
        return {
            "duration": float(probe["format"]["duration"]),
            "size": int(probe["format"]["size"]),
            "bitrate": int(probe["format"]["bit_rate"]),
            "video": {
                "codec": video_info.get("codec_name"),
                "width": video_info.get("width"),
                "height": video_info.get("height"),
                "fps": eval(video_info.get("r_frame_rate", "0/1")),
            },
            "audio": {
                "codec": audio_info.get("codec_name") if audio_info else None,
                "sample_rate": audio_info.get("sample_rate") if audio_info else None,
                "channels": audio_info.get("channels") if audio_info else None,
            } if audio_info else None,
        }
        
    finally:
        # Cleanup
        if os.path.exists(temp_video.name):
            os.unlink(temp_video.name)


@router.post("/compress")
async def compress_video(
    file: UploadFile = File(...),
    quality: str = Form("medium")  # low, medium, high
):
    """
    Compress video file to reduce size.
    
    Quality presets:
    - low: Fast encoding, larger file
    - medium: Balanced
    - high: Slow encoding, smaller file
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Save uploaded file temporarily
    temp_video = tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix)
    output_path = temp_video.name.replace(Path(temp_video.name).suffix, "_compressed.mp4")
    
    try:
        content = await file.read()
        temp_video.write(content)
        temp_video.close()
        
        # Compression presets
        presets = {
            "low": "fast",
            "medium": "medium",
            "high": "slow"
        }
        preset = presets.get(quality, "medium")
        
        # Compress using ffmpeg
        try:
            ffmpeg.input(temp_video.name).output(
                output_path,
                vcodec="libx264",
                crf=23,
                preset=preset,
                acodec="aac",
                audio_bitrate="128k"
            ).overwrite_output().run(capture_stdout=True, capture_stderr=True)
        except ffmpeg.Error as e:
            raise HTTPException(
                status_code=500,
                detail=f"FFmpeg error: {e.stderr.decode()}"
            )
        
        # Return compressed video
        return FileResponse(
            output_path,
            media_type="video/mp4",
            filename="compressed.mp4",
        )
        
    finally:
        # Cleanup
        if os.path.exists(temp_video.name):
            os.unlink(temp_video.name)

