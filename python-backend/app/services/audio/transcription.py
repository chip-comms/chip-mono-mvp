"""
Transcription Service using WhisperX

Status: ✅ IMPLEMENTED

This service handles speech-to-text conversion with word-level timestamps.
Uses WhisperX for improved accuracy and alignment.
"""

from typing import Optional, List, Dict, Any
from pathlib import Path
import logging
import torch

logger = logging.getLogger(__name__)


class TranscriptionService:
    """
    WhisperX-based transcription service.
    
    Features:
    - Word-level timestamps
    - Language detection
    - High accuracy alignment
    - Multiple model sizes
    """
    
    def __init__(
        self,
        model_size: str = "small",
        device: str = "auto",
        compute_type: str = "float32"
    ):
        """
        Initialize transcription service.
        
        Args:
            model_size: Model size (tiny, base, small, medium, large)
            device: Device to use (auto, cpu, cuda, mps)
            compute_type: Computation precision (float32, float16, int8)
        """
        self.model_size = model_size
        
        # Auto-detect device if not specified
        if device == "auto":
            if torch.cuda.is_available():
                self.device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self.device = "mps"
            else:
                self.device = "cpu"
        else:
            self.device = device
        
        self.compute_type = compute_type
        self.model = None
        self.align_model = None
        self.align_metadata = None
        
        logger.info(f"✅ Initializing TranscriptionService with {model_size} model on {self.device}")
    
    def load_model(self):
        """Load WhisperX model and alignment model."""
        if self.model is not None:
            return  # Already loaded
        
        try:
            import whisperx
            
            logger.info(f"📥 Loading WhisperX model: {self.model_size}...")
            
            # Load main transcription model
            self.model = whisperx.load_model(
                self.model_size,
                self.device,
                compute_type=self.compute_type
            )
            
            logger.info(f"✅ WhisperX model loaded successfully")
            
        except ImportError as e:
            logger.error("❌ WhisperX not installed. Run: pip install whisperx")
            raise ImportError(
                "WhisperX not installed. Install with: pip install whisperx"
            ) from e
        except Exception as e:
            logger.error(f"❌ Failed to load WhisperX model: {e}")
            raise
    
    def load_align_model(self, language: str):
        """Load alignment model for word-level timestamps."""
        try:
            import whisperx
            
            if self.align_model is None or self.align_metadata is None:
                logger.info(f"📥 Loading alignment model for language: {language}")
                self.align_model, self.align_metadata = whisperx.load_align_model(
                    language_code=language,
                    device=self.device
                )
                logger.info("✅ Alignment model loaded")
                
        except Exception as e:
            logger.warning(f"⚠️ Failed to load alignment model: {e}")
            # Continue without alignment
    
    def transcribe(
        self,
        audio_path: Path,
        language: Optional[str] = None,
        batch_size: int = 16
    ) -> Dict[str, Any]:
        """
        Transcribe audio file to text with timestamps.
        
        Args:
            audio_path: Path to audio file
            language: Language code (e.g. 'en', 'es') or None for auto-detect
            batch_size: Batch size for processing
        
        Returns:
            Dictionary with:
                - text: Full transcript
                - segments: List of segments with timestamps
                - language: Detected/specified language
                - duration: Audio duration in seconds
        """
        try:
            import whisperx
            
            # Load model if not already loaded
            if self.model is None:
                self.load_model()
            
            logger.info(f"🎤 Transcribing: {audio_path}")
            
            # Load audio
            audio = whisperx.load_audio(str(audio_path))
            
            # Transcribe
            result = self.model.transcribe(
                audio,
                language=language,
                batch_size=batch_size
            )
            
            detected_language = result.get("language", language or "en")
            logger.info(f"🗣️ Detected language: {detected_language}")
            
            # Try to align for word-level timestamps
            try:
                self.load_align_model(detected_language)
                
                if self.align_model and self.align_metadata:
                    logger.info("⏱️ Aligning timestamps...")
                    result = whisperx.align(
                        result["segments"],
                        self.align_model,
                        self.align_metadata,
                        audio,
                        self.device,
                        return_char_alignments=False
                    )
            except Exception as e:
                logger.warning(f"⚠️ Alignment failed, using basic timestamps: {e}")
            
            # Format output
            segments = result.get("segments", [])
            full_text = " ".join([s["text"].strip() for s in segments if s.get("text")])
            
            # Calculate duration
            duration = segments[-1]["end"] if segments else 0.0
            
            output = {
                "text": full_text,
                "segments": [
                    {
                        "start": seg.get("start", 0.0),
                        "end": seg.get("end", 0.0),
                        "text": seg.get("text", "").strip(),
                        "words": seg.get("words", [])  # Word-level if aligned
                    }
                    for seg in segments
                ],
                "language": detected_language,
                "duration": duration
            }
            
            logger.info(f"✅ Transcription complete: {len(segments)} segments, {duration:.1f}s")
            
            return output
            
        except Exception as e:
            logger.error(f"❌ Transcription failed: {e}")
            raise Exception(f"Failed to transcribe audio: {str(e)}")
    
    def transcribe_with_words(
        self,
        audio_path: Path,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribe with word-level timestamps.
        
        Returns segments with individual word timings.
        """
        # Same as transcribe, alignment is automatic
        result = self.transcribe(audio_path, language)
        
        # Verify we have word-level timestamps
        has_words = any(
            seg.get("words") and len(seg["words"]) > 0
            for seg in result["segments"]
        )
        
        if not has_words:
            logger.warning("⚠️ No word-level timestamps available")
        
        return result
    
    def get_supported_languages(self) -> List[str]:
        """Get list of supported languages."""
        # Common languages supported by Whisper
        return [
            "en",  # English
            "es",  # Spanish
            "fr",  # French
            "de",  # German
            "it",  # Italian
            "pt",  # Portuguese
            "nl",  # Dutch
            "ja",  # Japanese
            "zh",  # Chinese
            "ko",  # Korean
            "ru",  # Russian
            "ar",  # Arabic
            # ... Whisper supports 99 languages
        ]


# Example usage
"""
service = TranscriptionService(model_size="small", device="cpu")
result = service.transcribe("meeting.wav", language="en")

print(result["text"])
for segment in result["segments"]:
    print(f"[{segment['start']:.2f}s - {segment['end']:.2f}s]: {segment['text']}")
    
    # Word-level timestamps (if available)
    for word in segment.get("words", []):
        print(f"  {word['start']:.2f}s: {word['word']}")
"""

