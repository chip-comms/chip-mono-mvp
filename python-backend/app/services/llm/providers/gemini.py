"""
Google Gemini AI Provider

Uses Gemini Flash for fast, cost-effective analysis.
Python equivalent of supabase-backend/lib/ai/providers/gemini.ts
"""

import json
import re
import logging
from typing import List
from .base import (
    BaseAIProvider,
    AnalysisResult,
    ActionItem,
    KeyTopic,
    Sentiment,
    CompanyValue,
    CompanyValuesAlignment,
)

logger = logging.getLogger(__name__)


class GeminiProvider(BaseAIProvider):
    """
    Google Gemini AI provider using gemini-flash-latest.

    Features:
    - Fast processing
    - Cost-effective
    - Good quality analysis
    """

    @property
    def name(self) -> str:
        return "Gemini"

    def __init__(self, api_key: str):
        """
        Initialize Gemini provider.

        Args:
            api_key: Google AI Studio API key
        """
        super().__init__(api_key)
        self.client = None

    def _get_client(self):
        """Lazy load Google Generative AI client."""
        if self.client is None:
            try:
                import google.generativeai as genai

                genai.configure(api_key=self.api_key)
                self.client = genai
            except ImportError:
                raise ImportError(
                    "google-generativeai package not installed. "
                    "Install it with: pip install google-generativeai"
                )
        return self.client

    async def analyze_transcript(
        self, transcript_text: str, company_values: List[str] = None
    ) -> AnalysisResult:
        """
        Analyze transcript using Gemini Flash.

        Args:
            transcript_text: Full transcript text
            company_values: Optional list of company values

        Returns:
            AnalysisResult with insights
        """
        try:
            genai = self._get_client()
            model = genai.GenerativeModel("gemini-2.0-flash-exp")

            # Truncate if needed
            truncated_text = self.truncate_transcript(transcript_text)
            values_text = self.format_company_values(company_values or [])

            prompt = f"""
Analyze this meeting transcript and provide insights in JSON format.

TRANSCRIPT:
{truncated_text}

COMPANY VALUES TO ANALYZE:
{values_text}

Please provide a JSON response with exactly this structure:
{{
  "summary": "A concise 2-3 sentence summary of the meeting",
  "actionItems": [
    {{
      "text": "Specific action item",
      "priority": "high|medium|low"
    }}
  ],
  "keyTopics": [
    {{
      "topic": "Topic name",
      "relevance": 0.8
    }}
  ],
  "sentiment": {{
    "overall": "positive|neutral|negative",
    "score": 0.2
  }},
  "companyValuesAlignment": {{
    "overallAlignment": 0.7,
    "values": [
      {{
        "value": "Company value name",
        "score": 0.8,
        "examples": ["Quote from transcript showing this value"]
      }}
    ]
  }}
}}

Ensure all scores are between 0 and 1, and sentiment score is between -1 and 1.
Provide only valid JSON, no other text.
"""

            # Generate response
            response = model.generate_content(prompt)
            text = response.text.strip()

            # Clean up markdown code blocks if present
            text = re.sub(r"^```json\s*", "", text)
            text = re.sub(r"^```\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

            # Parse JSON
            analysis = json.loads(text.strip())

            # Convert to dataclasses
            return AnalysisResult(
                summary=analysis.get("summary", "No summary available"),
                action_items=[
                    ActionItem(
                        text=item["text"], priority=item.get("priority", "medium")
                    )
                    for item in analysis.get("actionItems", [])
                ],
                key_topics=[
                    KeyTopic(
                        topic=topic["topic"], relevance=topic.get("relevance", 0.5)
                    )
                    for topic in analysis.get("keyTopics", [])
                ],
                sentiment=Sentiment(
                    overall=analysis.get("sentiment", {}).get("overall", "neutral"),
                    score=analysis.get("sentiment", {}).get("score", 0.0),
                ),
                company_values_alignment=(
                    self._parse_values_alignment(analysis.get("companyValuesAlignment"))
                    if company_values
                    else None
                ),
            )

        except Exception as error:
            logger.error(f"Gemini analysis error: {error}")
            raise Exception(f"Failed to analyze transcript with Gemini: {str(error)}")

    async def generate_speaker_communication_tips(
        self,
        speaker_label: str,
        talk_time_percentage: float,
        word_count: int,
        segments_count: int,
        avg_response_latency: float,
        times_interrupted: int,
        times_interrupting: int,
        total_speakers: int,
        meeting_duration_minutes: float,
    ) -> List[str]:
        """
        Generate actionable communication tips for a specific speaker.

        Args:
            speaker_label: Speaker identifier
            talk_time_percentage: % of meeting time this speaker talked
            word_count: Total words spoken
            segments_count: Number of speaking segments
            avg_response_latency: Average gap before responding
            times_interrupted: Times this speaker was interrupted
            times_interrupting: Times this speaker interrupted others
            total_speakers: Total speakers in meeting
            meeting_duration_minutes: Total meeting duration

        Returns:
            List of 2-3 actionable tips
        """
        try:
            genai = self._get_client()
            model = genai.GenerativeModel("gemini-2.0-flash-exp")

            prompt = f"""
Generate 2-3 specific, actionable communication tips for {speaker_label} based on \
their behavior in this meeting.

SPEAKER METRICS:
- Talk time: {talk_time_percentage:.1f}% of meeting
- Word count: {word_count} words
- Speaking segments: {segments_count}
- Average response time: {avg_response_latency:.2f} seconds
- Times interrupted by others: {times_interrupted}
- Times interrupted others: {times_interrupting}
- Total speakers: {total_speakers}
- Meeting duration: {meeting_duration_minutes:.0f} minutes

GUIDELINES:
- Focus on communication skills and conversational dynamics
- Be specific and actionable (e.g., "Try X" not "Consider doing better")
- Be constructive and encouraging
- Address the most significant patterns first
- Each tip should be 1 sentence

Return ONLY a JSON array of 2-3 tip strings. Example:
["Tip 1 here", "Tip 2 here", "Tip 3 here"]
"""

            response = model.generate_content(prompt)
            text = response.text.strip()

            # Clean up markdown code blocks if present
            text = re.sub(r"^```json\s*", "", text)
            text = re.sub(r"^```\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

            # Parse JSON array
            tips = json.loads(text.strip())

            if not isinstance(tips, list):
                return [
                    "Focus on balanced participation in meetings.",
                    "Practice active listening and timely responses.",
                ]

            return tips[:3]  # Limit to 3 tips

        except Exception as error:
            logger.error(f"Gemini speaker tips error for {speaker_label}: {error}")
            # Return generic fallback tips
            return [
                "Focus on balanced participation in meetings.",
                "Practice active listening and timely responses.",
            ]

    def _parse_values_alignment(self, data: dict) -> CompanyValuesAlignment:
        """Parse company values alignment from JSON."""
        if not data:
            return None

        return CompanyValuesAlignment(
            overall_alignment=data.get("overallAlignment", 0.0),
            values=[
                CompanyValue(
                    value=v["value"],
                    score=v.get("score", 0.0),
                    examples=v.get("examples", []),
                )
                for v in data.get("values", [])
            ],
        )


# Dependencies needed:
"""
pip install google-generativeai
"""
