"""
Mock Transcription Provider

Provides fake transcription data for local development and testing.
Does not require any API keys or external services.
"""

import time
import logging
from pathlib import Path
from typing import Optional

from .base import BaseTranscriptionProvider, TranscriptionResult

logger = logging.getLogger(__name__)


class MockProvider(BaseTranscriptionProvider):
    """
    Mock transcription provider for local development.

    Returns realistic fake data to test the full pipeline without ML dependencies.
    """

    def __init__(self):
        """Initialize mock provider (no API key needed)."""
        super().__init__(api_key=None)

    @property
    def name(self) -> str:
        """Provider name."""
        return "mock"

    async def is_available(self) -> bool:
        """Mock provider is always available."""
        return True

    async def transcribe(
        self,
        audio_path: Path,
        language: Optional[str] = None,
        enable_diarization: bool = True,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
    ) -> TranscriptionResult:
        """
        Mock transcribe method that returns fake transcription data.

        Args:
            audio_path: Path to audio file (not actually used in mock)
            language: Language code (not used)
            enable_diarization: Whether to include speaker labels
            min_speakers: Not used in mock
            max_speakers: Not used in mock

        Returns:
            TranscriptionResult with mock data
        """
        logger.info(f"🎭 Using MOCK transcription for: {audio_path}")

        # Simulate processing time
        time.sleep(0.5)

        # Return realistic mock data
        full_text = (
            "This is a mock transcription. In a real implementation, this would "
            "contain the actual transcribed text from the audio file. For now, "
            "we're returning sample data to test the pipeline without heavy ML "
            "dependencies. Let's discuss the project timeline and next steps."
        )

        segment1_text = "This is a mock transcription."
        segment2_text = (
            "In a real implementation, this would contain the actual transcribed "
            "text from the audio file."
        )
        segment3_text = (
            "For now, we're returning sample data to test the pipeline without "
            "heavy ML dependencies."
        )
        segment4_text = "Let's discuss the project timeline and next steps."

        segments = [
            {
                "start": 0.0,
                "end": 3.5,
                "text": segment1_text,
                "speaker": "SPEAKER_A",
                "confidence": 0.95,
                "words": [
                    {"word": "This", "start": 0.0, "end": 0.2, "confidence": 0.98},
                    {"word": "is", "start": 0.3, "end": 0.4, "confidence": 0.99},
                    {"word": "a", "start": 0.5, "end": 0.6, "confidence": 0.99},
                    {"word": "mock", "start": 0.7, "end": 1.0, "confidence": 0.97},
                    {
                        "word": "transcription",
                        "start": 1.1,
                        "end": 1.8,
                        "confidence": 0.96,
                    },
                ],
            },
            {
                "start": 4.0,
                "end": 10.5,
                "text": segment2_text,
                "speaker": "SPEAKER_B",
                "confidence": 0.92,
                "words": [],
            },
            {
                "start": 11.0,
                "end": 16.0,
                "text": segment3_text,
                "speaker": "SPEAKER_A",
                "confidence": 0.94,
                "words": [],
            },
            {
                "start": 16.5,
                "end": 20.0,
                "text": segment4_text,
                "speaker": "SPEAKER_B",
                "confidence": 0.93,
                "words": [],
            },
        ]

        return TranscriptionResult(
            text=full_text,
            segments=segments,
            speakers=["SPEAKER_A", "SPEAKER_B"],
            language=language or "en",
            duration=20.0,
            num_speakers=2,
        )
