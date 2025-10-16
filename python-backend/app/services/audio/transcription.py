"""
Transcription Service Wrapper

Uses provider pattern to support multiple transcription backends:
- AssemblyAI (production - API-based)
- Mock (local development - no API key required)

Provider selection via TRANSCRIPTION_PROVIDER environment variable.
"""

from typing import Optional, Dict, Any
from pathlib import Path
import logging
import os

from .providers import (
    TranscriptionProvider,
    TranscriptionResult,
    AssemblyAIProvider,
    MockProvider,
)

logger = logging.getLogger(__name__)


class TranscriptionService:
    """
    Transcription service that delegates to configured provider.

    Supports multiple backends via provider pattern (similar to LLMAdapter).
    """

    def __init__(
        self,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        """
        Initialize transcription service.

        Args:
            provider: Provider name ('assemblyai' or 'mock'). Auto-detected if None.
            api_key: API key for the provider. Auto-detected from env if None.
        """
        self.provider_name = provider or os.getenv("TRANSCRIPTION_PROVIDER", "assemblyai")
        self.api_key = api_key or os.getenv("ASSEMBLYAI_API_KEY")

        # Initialize the appropriate provider
        self.provider = self._init_provider()

        logger.info(f"🎙️  Transcription service initialized with provider: {self.provider.name}")

    def _init_provider(self) -> TranscriptionProvider:
        """
        Initialize the transcription provider based on configuration.

        Returns:
            Initialized TranscriptionProvider instance

        Raises:
            ValueError: If provider is unknown or configuration is invalid
        """
        provider_name = self.provider_name.lower()

        if provider_name == "assemblyai":
            if not self.api_key:
                logger.warning(
                    "AssemblyAI API key not found. Falling back to mock provider. "
                    "Set ASSEMBLYAI_API_KEY environment variable to use real transcription."
                )
                return MockProvider()
            return AssemblyAIProvider(api_key=self.api_key)

        elif provider_name == "mock":
            logger.info("Using mock transcription provider (no API calls)")
            return MockProvider()

        else:
            raise ValueError(
                f"Unknown transcription provider: {provider_name}. "
                f"Supported providers: 'assemblyai', 'mock'"
            )

    async def transcribe(
        self,
        audio_path: Path,
        language: Optional[str] = None,
        enable_diarization: bool = True,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Transcribe audio file with optional speaker diarization.

        Args:
            audio_path: Path to audio file
            language: Language code (e.g., 'en', 'es') or None for auto-detect
            enable_diarization: Whether to perform speaker diarization
            min_speakers: Minimum number of speakers (for diarization)
            max_speakers: Maximum number of speakers (for diarization)

        Returns:
            Dictionary with:
                - text: Full transcript
                - segments: List of segments with timestamps and speakers
                - speakers: List of detected speakers
                - language: Detected/specified language
                - duration: Audio duration in seconds
                - num_speakers: Number of detected speakers
        """
        try:
            result = await self.provider.transcribe(
                audio_path=audio_path,
                language=language,
                enable_diarization=enable_diarization,
                min_speakers=min_speakers,
                max_speakers=max_speakers,
            )

            # Convert TranscriptionResult to dict format expected by existing code
            return {
                "text": result.text,
                "segments": result.segments,
                "speakers": result.speakers,
                "language": result.language,
                "duration": result.duration,
                "num_speakers": result.num_speakers,
            }

        except Exception as e:
            logger.error(f"Transcription failed: {str(e)}")
            return {"error": str(e)}

    def transcribe_with_words(
        self, audio_path: Path, language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribe with word-level timestamps (synchronous wrapper).

        This is a compatibility method for existing code that expects synchronous calls.
        For new code, prefer the async transcribe() method.

        Args:
            audio_path: Path to audio file
            language: Language code or None for auto-detect

        Returns:
            Transcription result dictionary
        """
        import asyncio

        # Create event loop if needed
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # Run async transcription
        return loop.run_until_complete(
            self.transcribe(audio_path, language, enable_diarization=True)
        )

    def get_supported_languages(self) -> list[str]:
        """
        Get list of supported languages.

        Returns:
            List of language codes
        """
        # Standard language support across most providers
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
