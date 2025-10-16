"""
AI Provider Base Interface

Defines the contract that all AI providers must implement.
Python equivalent of supabase-backend/lib/ai/providers/base.ts
"""

from abc import ABC, abstractmethod
from typing import Optional, List
from dataclasses import dataclass


@dataclass
class ActionItem:
    """Action item from meeting analysis."""
    text: str
    priority: str  # "high" | "medium" | "low"


@dataclass
class KeyTopic:
    """Key topic identified in meeting."""
    topic: str
    relevance: float  # 0.0 to 1.0


@dataclass
class Sentiment:
    """Sentiment analysis result."""
    overall: str  # "positive" | "neutral" | "negative"
    score: float  # -1.0 to 1.0


@dataclass
class CompanyValue:
    """Company value alignment."""
    value: str
    score: float  # 0.0 to 1.0
    examples: List[str]


@dataclass
class CompanyValuesAlignment:
    """Overall company values alignment."""
    overall_alignment: float  # 0.0 to 1.0
    values: List[CompanyValue]


@dataclass
class AnalysisResult:
    """Result from transcript analysis."""
    summary: str
    action_items: List[ActionItem]
    key_topics: List[KeyTopic]
    sentiment: Sentiment
    company_values_alignment: Optional[CompanyValuesAlignment] = None


class AIProvider(ABC):
    """
    Abstract base class for AI providers.

    All LLM providers (OpenAI, Gemini, Anthropic, etc.) must implement this interface.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """The name of the AI provider."""

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if this provider is available (has valid API key)."""

    @abstractmethod
    async def analyze_transcript(
        self,
        transcript_text: str,
        company_values: List[str] = None
    ) -> AnalysisResult:
        """
        Analyze a transcript and generate insights.

        Args:
            transcript_text: Full transcript text
            company_values: Optional list of company values to analyze against

        Returns:
            AnalysisResult with summary, action items, topics, sentiment, etc.
        """

    @abstractmethod
    async def generate_communication_insights(
        self,
        transcript_text: str,
        talk_time_percentage: float,
        interruptions: int,
        num_speakers: int,
        duration_minutes: float
    ) -> str:
        """
        Generate communication insights from transcript data.

        Args:
            transcript_text: Full transcript text
            talk_time_percentage: Percentage of time spent talking
            interruptions: Number of interruptions
            num_speakers: Number of speakers
            duration_minutes: Meeting duration in minutes

        Returns:
            String with communication insights (2-3 sentences)
        """


class BaseAIProvider(AIProvider):
    """
    Base class for AI providers with common utilities.

    Provides helper methods that all providers can use.
    """

    def __init__(self, api_key: str):
        """
        Initialize provider with API key.

        Args:
            api_key: API key for the provider
        """
        self.api_key = api_key

    async def is_available(self) -> bool:
        """
        Check if provider is available.

        Default implementation checks if API key exists and has reasonable length.
        """
        return bool(self.api_key and len(self.api_key) > 10)

    def truncate_transcript(
        self,
        transcript_text: str,
        max_length: int = 50000
    ) -> str:
        """
        Helper method to truncate long transcripts if needed.

        Breaks at word boundaries for cleaner truncation.

        Args:
            transcript_text: Full transcript
            max_length: Maximum length in characters

        Returns:
            Truncated transcript (if needed)
        """
        if len(transcript_text) <= max_length:
            return transcript_text

        # Truncate to maxLength but break at word boundaries
        truncated = transcript_text[:max_length]
        last_space_index = truncated.rfind(' ')

        if last_space_index > 0:
            return truncated[:last_space_index] + '... [truncated]'

        return truncated + '... [truncated]'

    def format_company_values(self, values: List[str]) -> str:
        """
        Helper method to format company values for prompts.

        Args:
            values: List of company values

        Returns:
            Formatted string with numbered values
        """
        if not values:
            return "No specific company values provided."

        return "\n".join(
            f"{i + 1}. {value}"
            for i, value in enumerate(values)
        )
