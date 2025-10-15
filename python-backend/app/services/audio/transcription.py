"""
Transcription Service using WhisperX

Status: ✅ IMPLEMENTED

This service handles speech-to-text conversion with word-level timestamps
and speaker diarization using WhisperX.
"""

from typing import Optional, Dict, Any
from pathlib import Path
import logging
import os
import whisperx
import gc
import torch

logger = logging.getLogger(__name__)


class TranscriptionService:
    """
    WhisperX-based transcription service with speaker diarization.

    Features:
    - Fast transcription (70x realtime with large-v2)
    - Word-level timestamps
    - Speaker diarization
    - Multiple languages
    - GPU acceleration (optional)
    """

    def __init__(
        self,
        model_name: str = "base",
        device: str = "auto",
        compute_type: str = "float16"
    ):
        """
        Initialize transcription service.

        Args:
            model_name: Whisper model name (tiny, base, small, medium, large-v2, large-v3)
            device: Device to use ("cuda", "cpu", or "auto")
            compute_type: Compute type ("float16", "int8", "float32")
        """
        self.model_name = model_name

        # Auto-detect device if requested
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        # Adjust compute type based on device
        if self.device == "cpu":
            self.compute_type = "int8"  # CPU works better with int8
        else:
            self.compute_type = compute_type

        # Get Hugging Face token for diarization
        self.hf_token = os.getenv("HUGGINGFACE_TOKEN")

        logger.info(f"✅ Initializing WhisperX with model={model_name}, device={self.device}, compute_type={self.compute_type}")
        if not self.hf_token:
            logger.warning("⚠️  HUGGINGFACE_TOKEN not set - diarization will be disabled")

    def transcribe(
        self,
        audio_path: Path,
        language: Optional[str] = None,
        enable_diarization: bool = True,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Transcribe audio file with word-level timestamps and speaker diarization.

        Args:
            audio_path: Path to audio file
            language: Language code (e.g. 'en', 'es') or None for auto-detection
            enable_diarization: Whether to perform speaker diarization
            min_speakers: Minimum number of speakers (optional)
            max_speakers: Maximum number of speakers (optional)

        Returns:
            Dictionary with:
                - text: Full transcript
                - segments: List of segments with timestamps and speaker labels
                - language: Detected/specified language
                - word_segments: Word-level timestamps (if available)
        """
        try:
            logger.info(f"🎤 Transcribing: {audio_path}")
            logger.info(f"   Device: {self.device}, Compute: {self.compute_type}")

            # Load WhisperX model
            logger.info(f"   Loading WhisperX model: {self.model_name}")
            model = whisperx.load_model(
                self.model_name,
                self.device,
                compute_type=self.compute_type,
                language=language
            )

            # Load audio
            logger.info(f"   Loading audio file...")
            audio = whisperx.load_audio(str(audio_path))

            # Transcribe
            logger.info(f"   Transcribing...")
            result = model.transcribe(audio, batch_size=16)

            detected_language = result.get("language", language or "en")
            logger.info(f"   Language: {detected_language}")

            # Clean up model to free memory
            del model
            gc.collect()
            if self.device == "cuda":
                torch.cuda.empty_cache()

            # Align whisper output for word-level timestamps
            logger.info(f"   Aligning for word-level timestamps...")
            model_a, metadata = whisperx.load_align_model(
                language_code=detected_language,
                device=self.device
            )
            result = whisperx.align(
                result["segments"],
                model_a,
                metadata,
                audio,
                self.device,
                return_char_alignments=False
            )

            # Clean up alignment model
            del model_a
            gc.collect()
            if self.device == "cuda":
                torch.cuda.empty_cache()

            # Perform speaker diarization if enabled and token available
            if enable_diarization and self.hf_token:
                logger.info(f"   Performing speaker diarization...")

                diarize_model = whisperx.DiarizationPipeline(
                    use_auth_token=self.hf_token,
                    device=self.device
                )

                diarize_segments = diarize_model(
                    audio,
                    min_speakers=min_speakers,
                    max_speakers=max_speakers
                )

                # Assign speakers to words
                result = whisperx.assign_word_speakers(diarize_segments, result)

                # Clean up diarization model
                del diarize_model
                gc.collect()
                if self.device == "cuda":
                    torch.cuda.empty_cache()

                logger.info(f"   Diarization complete")
            elif enable_diarization and not self.hf_token:
                logger.warning("   Skipping diarization - HUGGINGFACE_TOKEN not set")

            # Format output
            segments = result.get("segments", [])
            full_text = " ".join(seg.get("text", "").strip() for seg in segments)

            # Extract word-level timestamps if available
            word_segments = []
            for segment in segments:
                if "words" in segment:
                    word_segments.extend(segment["words"])

            logger.info(f"✅ Transcription complete: {len(segments)} segments")
            if word_segments:
                logger.info(f"   Word-level timestamps: {len(word_segments)} words")

            return {
                "text": full_text,
                "segments": segments,
                "language": detected_language,
                "word_segments": word_segments
            }

        except Exception as e:
            logger.error(f"❌ Transcription failed: {e}")
            raise RuntimeError(f"Transcription failed: {str(e)}")
        finally:
            # Final cleanup
            gc.collect()
            if self.device == "cuda":
                torch.cuda.empty_cache()

    def transcribe_with_words(
        self,
        audio_path: Path,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribe with word-level timestamps.

        This is an alias for transcribe() since WhisperX provides
        word-level timestamps by default.
        """
        return self.transcribe(audio_path, language, enable_diarization=True)

    def get_supported_languages(self) -> list[str]:
        """Get list of supported languages."""
        # Whisper supports 99 languages
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
            "hi",  # Hindi
            "tr",  # Turkish
            "pl",  # Polish
            "uk",  # Ukrainian
            "vi",  # Vietnamese
            # ... Whisper supports 99 total languages
        ]


# Example usage
"""
service = TranscriptionService(model_name="base", device="auto")
result = service.transcribe(Path("meeting.wav"), language="en")

print(result["text"])
for segment in result["segments"]:
    speaker = segment.get("speaker", "Unknown")
    print(f"[{segment['start']:.2f}s - {segment['end']:.2f}s] {speaker}: {segment['text']}")
"""
