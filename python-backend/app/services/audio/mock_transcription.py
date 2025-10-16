"""
Mock transcription service for local development.
Returns realistic fake data to test the full pipeline without ML dependencies.

TODO: Replace with real implementation in CHI-22
"""

import time
from pathlib import Path
from typing import Dict, Any


class MockTranscriptionService:
    """Mock transcription service that returns fake but realistic data."""

    def transcribe(self, audio_file: Path) -> Dict[str, Any]:
        """
        Mock transcribe method that returns fake transcription data.

        Args:
            audio_file: Path to audio/video file (not actually used in mock)

        Returns:
            Dictionary with mock transcription data
        """
        # Simulate processing time
        time.sleep(0.5)

        # Return realistic mock data
        full_text = (
            "This is a mock transcription. In a real implementation, this would "
            "contain the actual transcribed text from the audio file. For now, "
            "we're returning sample data to test the pipeline without heavy ML "
            "dependencies."
        )
        segment2_text = (
            "In a real implementation, this would contain the actual transcribed "
            "text from the audio file."
        )
        segment3_text = (
            "For now, we're returning sample data to test the pipeline without "
            "heavy ML dependencies."
        )

        return {
            "text": full_text,
            "segments": [
                {
                    "start": 0.0,
                    "end": 3.5,
                    "text": "This is a mock transcription.",
                    "speaker": "SPEAKER_00",
                    "words": [
                        {"word": "This", "start": 0.0, "end": 0.2},
                        {"word": "is", "start": 0.3, "end": 0.4},
                        {"word": "a", "start": 0.5, "end": 0.6},
                        {"word": "mock", "start": 0.7, "end": 1.0},
                        {"word": "transcription", "start": 1.1, "end": 1.8},
                    ],
                },
                {
                    "start": 4.0,
                    "end": 10.5,
                    "text": segment2_text,
                    "speaker": "SPEAKER_01",
                    "words": [],
                },
                {
                    "start": 11.0,
                    "end": 16.0,
                    "text": segment3_text,
                    "speaker": "SPEAKER_00",
                    "words": [],
                },
            ],
            "language": "en",
            "duration": 16.0,
        }
