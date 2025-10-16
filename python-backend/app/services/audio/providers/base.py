"""
Transcription Provider Base Interface

Defines the contract that all transcription providers must implement.
Similar to the LLM provider pattern in app/services/llm/providers/base.py
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from pathlib import Path


@dataclass
class TranscriptionSegment:
    """A segment of transcription with timing and speaker information."""

    start: float  # Start time in seconds
    end: float  # End time in seconds
    text: str  # Transcribed text
    speaker: str  # Speaker label (e.g., "SPEAKER_A", "SPEAKER_00")
    confidence: Optional[float] = None  # Confidence score 0-1
    words: Optional[List[Dict[str, Any]]] = None  # Word-level timestamps


@dataclass
class TranscriptionResult:
    """Result from transcription with diarization."""

    text: str  # Full transcript
    segments: List[TranscriptionSegment]  # Segments with speakers
    speakers: List[str]  # List of detected speakers
    language: str  # Detected/specified language
    duration: float  # Audio duration in seconds
    num_speakers: int  # Number of detected speakers


class TranscriptionProvider(ABC):
    """
    Abstract base class for transcription providers.

    All transcription providers (AssemblyAI, Deepgram, etc.) must implement this interface.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """The name of the transcription provider."""

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if this provider is available (has valid API key)."""

    @abstractmethod
    async def transcribe(
        self,
        audio_path: Path,
        language: Optional[str] = None,
        enable_diarization: bool = True,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
    ) -> TranscriptionResult:
        """
        Transcribe audio file with optional speaker diarization.

        Args:
            audio_path: Path to audio file
            language: Language code (e.g., 'en', 'es') or None for auto-detect
            enable_diarization: Whether to perform speaker diarization
            min_speakers: Minimum number of speakers (for diarization)
            max_speakers: Maximum number of speakers (for diarization)

        Returns:
            TranscriptionResult with transcript, segments, and speaker information
        """


class BaseTranscriptionProvider(TranscriptionProvider):
    """
    Base class for transcription providers with common utilities.

    Provides helper methods that all providers can use.
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize provider with optional API key.

        Args:
            api_key: API key for the provider (if required)
        """
        self.api_key = api_key

    async def is_available(self) -> bool:
        """
        Check if provider is available.

        Default implementation checks if API key exists and has reasonable length.
        """
        if not self.api_key:
            return False
        return len(self.api_key) > 10
