"""
OpenAI AI Provider

Uses GPT-4 for high-quality analysis.
Python equivalent of supabase-backend/lib/ai/providers/openai.ts
"""

import json
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


class OpenAIProvider(BaseAIProvider):
    """
    OpenAI AI provider using GPT-4.

    Features:
    - High quality analysis
    - Reliable JSON formatting
    - Good at complex reasoning
    """

    @property
    def name(self) -> str:
        return "OpenAI"

    def __init__(self, api_key: str):
        """
        Initialize OpenAI provider.

        Args:
            api_key: OpenAI API key
        """
        super().__init__(api_key)
        self.client = None

    def _get_client(self):
        """Lazy load OpenAI client."""
        if self.client is None:
            try:
                from openai import AsyncOpenAI

                self.client = AsyncOpenAI(api_key=self.api_key)
            except ImportError:
                raise ImportError(
                    "openai package not installed. "
                    "Install it with: pip install openai"
                )
        return self.client

    async def analyze_transcript(
        self, transcript_text: str, company_values: List[str] = None
    ) -> AnalysisResult:
        """
        Analyze transcript using GPT-4.

        Args:
            transcript_text: Full transcript text
            company_values: Optional list of company values

        Returns:
            AnalysisResult with insights
        """
        try:
            client = self._get_client()

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

            # Call GPT-4
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert meeting analyst. "
                            "Provide analysis in valid JSON format only."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )

            content = response.choices[0].message.content
            if not content:
                raise Exception("No response from GPT-4")

            # Parse JSON
            analysis = json.loads(content.strip())

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
            logger.error(f"OpenAI analysis error: {error}")
            raise Exception(f"Failed to analyze transcript with OpenAI: {str(error)}")

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
            client = self._get_client()

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

            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert communication coach. "
                            "Return only valid JSON arrays."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=300,
            )

            content = response.choices[0].message.content
            if not content:
                raise Exception("No response from GPT-4")

            # Parse JSON array
            tips = json.loads(content.strip())

            if not isinstance(tips, list):
                return [
                    "Focus on balanced participation in meetings.",
                    "Practice active listening and timely responses.",
                ]

            return tips[:3]  # Limit to 3 tips

        except Exception as error:
            logger.error(
                f"OpenAI speaker tips error for {speaker_label}: {error}"
            )
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
pip install openai
"""
