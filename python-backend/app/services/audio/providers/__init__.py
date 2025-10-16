"""
Audio transcription providers.

This module exports transcription providers for the audio service.
"""

from .base import TranscriptionProvider, TranscriptionResult
from .assemblyai import AssemblyAIProvider
from .mock import MockProvider

__all__ = [
    "TranscriptionProvider",
    "TranscriptionResult",
    "AssemblyAIProvider",
    "MockProvider",
]
