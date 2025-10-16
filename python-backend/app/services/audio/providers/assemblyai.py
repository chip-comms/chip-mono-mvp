"""
AssemblyAI Transcription Provider

Provides transcription and speaker diarization using AssemblyAI API.
Handles both transcription and diarization in a single API call.
"""

import logging
from pathlib import Path
from typing import Optional, Dict, Any
import assemblyai as aai

from .base import (
    BaseTranscriptionProvider,
    TranscriptionResult,
    TranscriptionSegment,
)

logger = logging.getLogger(__name__)


class AssemblyAIProvider(BaseTranscriptionProvider):
    """
    AssemblyAI transcription provider.

    Features:
    - Transcription with word-level timestamps
    - Automatic speaker diarization
    - Language detection
    - High accuracy
    """

    def __init__(self, api_key: str):
        """
        Initialize AssemblyAI provider.

        Args:
            api_key: AssemblyAI API key
        """
        super().__init__(api_key)
        aai.settings.api_key = api_key

    @property
    def name(self) -> str:
        """Provider name."""
        return "assemblyai"

    async def is_available(self) -> bool:
        """Check if AssemblyAI is available with valid API key."""
        return bool(self.api_key and len(self.api_key) > 10)

    async def transcribe(
        self,
        audio_path: Path,
        language: Optional[str] = None,
        enable_diarization: bool = True,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
    ) -> TranscriptionResult:
        """
        Transcribe audio using AssemblyAI.

        Args:
            audio_path: Path to audio file
            language: Language code (e.g., 'en', 'es') or None for auto-detect
            enable_diarization: Whether to perform speaker diarization
            min_speakers: Minimum number of speakers
            max_speakers: Maximum number of speakers

        Returns:
            TranscriptionResult with transcript and speaker information
        """
        logger.info(f"Starting AssemblyAI transcription for: {audio_path}")

        try:
            # Configure transcription settings
            config = aai.TranscriptionConfig(
                speaker_labels=enable_diarization,
                language_code=language if language else None,
            )

            # Create transcriber
            transcriber = aai.Transcriber()

            # Submit transcription job
            logger.info("Uploading audio to AssemblyAI...")
            transcript = transcriber.transcribe(str(audio_path), config=config)

            # Wait for completion
            if transcript.status == aai.TranscriptStatus.error:
                raise Exception(f"AssemblyAI transcription failed: {transcript.error}")

            logger.info(
                f"AssemblyAI transcription completed. Status: {transcript.status}"
            )

            # Parse results
            return self._parse_transcript(transcript)

        except Exception as e:
            logger.error(f"AssemblyAI transcription error: {str(e)}")
            raise Exception(f"AssemblyAI transcription failed: {str(e)}")

    def _parse_transcript(self, transcript: Any) -> TranscriptionResult:
        """
        Parse AssemblyAI transcript into TranscriptionResult format.

        Args:
            transcript: AssemblyAI Transcript object

        Returns:
            TranscriptionResult with parsed data
        """
        # Extract full text
        full_text = transcript.text or ""

        # Parse segments with speaker labels
        segments = []
        speakers_set = set()

        if transcript.utterances:
            # Use utterances (already grouped by speaker)
            for utterance in transcript.utterances:
                speaker_label = f"SPEAKER_{utterance.speaker}"
                speakers_set.add(speaker_label)

                # Extract words for this utterance
                words = []
                if utterance.words:
                    words = [
                        {
                            "word": word.text,
                            "start": word.start / 1000.0,  # Convert ms to seconds
                            "end": word.end / 1000.0,
                            "confidence": word.confidence,
                        }
                        for word in utterance.words
                    ]

                segments.append(
                    TranscriptionSegment(
                        start=utterance.start / 1000.0,  # Convert ms to seconds
                        end=utterance.end / 1000.0,
                        text=utterance.text,
                        speaker=speaker_label,
                        confidence=utterance.confidence,
                        words=words,
                    )
                )
        else:
            # Fallback: Use words if utterances not available
            if transcript.words:
                current_segment = None
                for word in transcript.words:
                    speaker_label = (
                        f"SPEAKER_{word.speaker}"
                        if hasattr(word, "speaker") and word.speaker
                        else "SPEAKER_00"
                    )
                    speakers_set.add(speaker_label)

                    # Group consecutive words by same speaker
                    if (
                        current_segment is None
                        or current_segment.speaker != speaker_label
                    ):
                        if current_segment:
                            segments.append(current_segment)
                        current_segment = TranscriptionSegment(
                            start=word.start / 1000.0,
                            end=word.end / 1000.0,
                            text=word.text,
                            speaker=speaker_label,
                            confidence=word.confidence,
                            words=[
                                {
                                    "word": word.text,
                                    "start": word.start / 1000.0,
                                    "end": word.end / 1000.0,
                                    "confidence": word.confidence,
                                }
                            ],
                        )
                    else:
                        # Extend current segment
                        current_segment.end = word.end / 1000.0
                        current_segment.text += f" {word.text}"
                        current_segment.words.append(
                            {
                                "word": word.text,
                                "start": word.start / 1000.0,
                                "end": word.end / 1000.0,
                                "confidence": word.confidence,
                            }
                        )

                if current_segment:
                    segments.append(current_segment)

        # Get audio duration (in seconds)
        duration = transcript.audio_duration or 0.0

        # Get detected language (handle different attribute names)
        language = getattr(transcript, 'language_code', None) or \
                   getattr(transcript, 'language', None) or "en"

        return TranscriptionResult(
            text=full_text,
            segments=[seg.__dict__ for seg in segments],  # Convert to dicts
            speakers=sorted(list(speakers_set)),
            language=language,
            duration=duration,
            num_speakers=len(speakers_set),
        )
