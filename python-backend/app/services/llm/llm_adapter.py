"""
LLM Adapter

Manages multiple AI providers and automatically selects the best available one.
Python equivalent of supabase-backend/lib/ai/ai-adapter.ts
"""

import os
import logging
from typing import List, Optional
from .providers.base import AIProvider, AnalysisResult
from .providers.gemini import GeminiProvider
from .providers.openai import OpenAIProvider

logger = logging.getLogger(__name__)


class LLMAdapter:
    """
    LLM Adapter with automatic provider selection.
    
    Supports multiple providers and automatically selects the best available one
    based on configuration and availability.
    
    Usage:
        adapter = LLMAdapter()
        provider = await adapter.get_provider()
        result = await provider.analyze_transcript(text, company_values)
    """
    
    def __init__(
        self,
        openai_api_key: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        preferred_provider: str = "auto"
    ):
        """
        Initialize LLM adapter.
        
        Args:
            openai_api_key: OpenAI API key (or from env: OPENAI_API_KEY)
            gemini_api_key: Gemini API key (or from env: GEMINI_API_KEY)
            preferred_provider: "auto" | "openai" | "gemini"
        """
        self.providers: List[AIProvider] = []
        self.selected_provider: Optional[AIProvider] = None
        self.preferred_provider = preferred_provider.lower()
        
        # Initialize providers
        self._initialize_providers(openai_api_key, gemini_api_key)
    
    def _initialize_providers(
        self,
        openai_key: Optional[str],
        gemini_key: Optional[str]
    ):
        """Initialize available providers based on configuration."""
        
        # Try environment variables if not provided
        openai_key = openai_key or os.getenv("OPENAI_API_KEY")
        gemini_key = gemini_key or os.getenv("GEMINI_API_KEY")
        
        # Initialize Gemini (usually cheaper, try first)
        if gemini_key:
            self.providers.append(GeminiProvider(gemini_key))
            logger.info("✅ Gemini provider initialized")
        
        # Initialize OpenAI
        if openai_key:
            self.providers.append(OpenAIProvider(openai_key))
            logger.info("✅ OpenAI provider initialized")
        
        # Add more providers here as needed
        # if anthropic_key:
        #     self.providers.append(AnthropicProvider(anthropic_key))
        
        if not self.providers:
            logger.warning("⚠️ No LLM providers configured. Set OPENAI_API_KEY or GEMINI_API_KEY")
    
    async def get_provider(self) -> AIProvider:
        """
        Get the best available AI provider.
        
        Returns:
            AIProvider instance
        
        Raises:
            Exception: If no provider is available
        """
        if self.selected_provider:
            return self.selected_provider
        
        # Check for preferred provider
        if self.preferred_provider != "auto":
            for provider in self.providers:
                if provider.name.lower() == self.preferred_provider:
                    if await provider.is_available():
                        logger.info(f"🤖 Using preferred AI provider: {provider.name}")
                        self.selected_provider = provider
                        return provider
            
            logger.warning(
                f"⚠️ Preferred provider '{self.preferred_provider}' not available, "
                f"falling back to auto-selection"
            )
        
        # Auto-select first available provider
        for provider in self.providers:
            if await provider.is_available():
                logger.info(f"🤖 Auto-selected AI provider: {provider.name}")
                self.selected_provider = provider
                return provider
        
        raise Exception(
            "No AI provider available. Please configure an API key for "
            "OpenAI (OPENAI_API_KEY), Gemini (GEMINI_API_KEY), "
            "or another supported provider."
        )
    
    async def get_available_providers(self) -> List[str]:
        """
        Get list of available provider names.
        
        Returns:
            List of provider names that are available
        """
        available = []
        for provider in self.providers:
            if await provider.is_available():
                available.append(provider.name)
        return available
    
    async def analyze_transcript(
        self,
        transcript_text: str,
        company_values: List[str] = None
    ) -> AnalysisResult:
        """
        Analyze transcript using the best available provider.
        
        Args:
            transcript_text: Full transcript text
            company_values: Optional list of company values
        
        Returns:
            AnalysisResult
        """
        provider = await self.get_provider()
        return await provider.analyze_transcript(transcript_text, company_values)
    
    async def generate_communication_insights(
        self,
        transcript_text: str,
        talk_time_percentage: float,
        interruptions: int,
        num_speakers: int = 2,
        duration_minutes: float = 30.0
    ) -> str:
        """
        Generate communication insights using the best available provider.
        
        Args:
            transcript_text: Full transcript
            talk_time_percentage: % time speaking
            interruptions: Number of interruptions
            num_speakers: Number of speakers
            duration_minutes: Meeting duration
        
        Returns:
            Communication insights string
        """
        provider = await self.get_provider()
        return await provider.generate_communication_insights(
            transcript_text,
            talk_time_percentage,
            interruptions,
            num_speakers,
            duration_minutes
        )
    
    def reset_provider(self):
        """Reset provider selection (for testing or switching providers)."""
        self.selected_provider = None


# Example usage:
"""
# Initialize adapter (auto-detects from environment)
adapter = LLMAdapter()

# Or specify keys directly
adapter = LLMAdapter(
    gemini_api_key="your-key",
    openai_api_key="your-key",
    preferred_provider="gemini"  # or "openai" or "auto"
)

# Get available providers
providers = await adapter.get_available_providers()
print(f"Available: {providers}")

# Analyze transcript
result = await adapter.analyze_transcript(
    transcript_text="Meeting transcript here...",
    company_values=["Innovation", "Customer Focus"]
)

print(result.summary)
for item in result.action_items:
    print(f"- [{item.priority}] {item.text}")
"""

