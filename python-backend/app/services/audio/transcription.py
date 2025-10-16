"""
Transcription Service Wrapper

For local development, uses mock data.
For production with ML enabled, uses WhisperX.

TODO: Implement real ML pipeline in CHI-22
"""

from typing import Optional, Dict, Any
from pathlib import Path
import logging

from .mock_transcription import MockTranscriptionService

logger = logging.getLogger(__name__)


class TranscriptionService:
    """
    Transcription service that delegates to mock implementation.

    TODO (CHI-22): Replace with real WhisperX implementation
    """

    def __init__(
        self,
        model_name: str = "base",
        device: str = "auto",
        compute_type: str = "float16",
    ):
        """Initialize transcription service (currently mock)."""
        logger.info("🎭 Using MOCK transcription service (CHI-22: implement real ML)")
        self.mock_service = MockTranscriptionService()

    def transcribe(
        self,
        audio_path: Path,
        language: Optional[str] = None,
        enable_diarization: bool = True,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Transcribe audio file (currently returns mock data).

        TODO (CHI-22): Implement real transcription with WhisperX
        """
        return self.mock_service.transcribe(audio_path)

    def transcribe_with_words(
        self, audio_path: Path, language: Optional[str] = None
    ) -> Dict[str, Any]:
        """Transcribe with word-level timestamps (currently mock)."""
        return self.transcribe(audio_path, language, enable_diarization=True)

    def get_supported_languages(self) -> list[str]:
        """Get list of supported languages."""
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
        ]
