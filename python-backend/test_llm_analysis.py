"""
Test script for LLM analysis using the generated transcript.

Usage:
    python test_llm_analysis.py
"""

import sys
import asyncio
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.llm import LLMAdapter
from app.config import settings


async def test_llm_analysis():
    """Test LLM analysis with the transcript."""
    
    # Load transcript
    transcript_path = Path("transcription_output.txt")
    
    if not transcript_path.exists():
        print(f"❌ Transcript file not found: {transcript_path}")
        print("Run test_transcription.py first to generate the transcript")
        return
    
    with open(transcript_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract just the transcript text (skip the segments part)
    transcript_text = content.split("SEGMENTS WITH TIMESTAMPS")[0]
    transcript_text = transcript_text.replace("FULL TRANSCRIPT", "").replace("=" * 80, "").strip()
    
    print("=" * 80)
    print("🤖 LLM ANALYSIS TEST")
    print("=" * 80)
    
    # Initialize LLM adapter
    print("\n📦 Initializing LLM adapter...")
    print(f"🔑 Gemini key available: {bool(settings.gemini_api_key)}")
    print(f"🔑 OpenAI key available: {bool(settings.openai_api_key)}")
    
    adapter = LLMAdapter(
        gemini_api_key=settings.gemini_api_key,
        openai_api_key=settings.openai_api_key,
        preferred_provider=settings.ai_provider
    )
    
    # Check available providers
    providers = await adapter.get_available_providers()
    print(f"✅ Available providers: {', '.join(providers)}")
    
    if not providers:
        print("\n❌ No LLM providers available!")
        print("Make sure GEMINI_API_KEY or OPENAI_API_KEY is set in .env.local")
        return
    
    # Company values to analyze
    company_values = [
        "Innovation",
        "Collaboration",
        "Customer Focus",
        "Transparency",
        "Growth Mindset"
    ]
    
    print(f"\n🎯 Analyzing transcript with company values:")
    for value in company_values:
        print(f"  - {value}")
    
    print(f"\n📝 Transcript length: {len(transcript_text)} characters")
    print(f"📖 Word count: {len(transcript_text.split())} words")
    
    # Analyze transcript
    print("\n🤖 Calling LLM for analysis...")
    print("⏱️ This may take 10-30 seconds...")
    
    try:
        result = await adapter.analyze_transcript(
            transcript_text=transcript_text,
            company_values=company_values
        )
        
        print("\n" + "=" * 80)
        print("✅ ANALYSIS COMPLETE!")
        print("=" * 80)
        
        # Display summary
        print("\n📋 SUMMARY:")
        print("-" * 80)
        print(result.summary)
        
        # Display action items
        print("\n✅ ACTION ITEMS:")
        print("-" * 80)
        for i, item in enumerate(result.action_items, 1):
            priority_emoji = {
                "high": "🔴",
                "medium": "🟡",
                "low": "🟢"
            }.get(item.priority, "⚪")
            print(f"{i}. {priority_emoji} [{item.priority.upper()}] {item.text}")
        
        # Display key topics
        print("\n🏷️ KEY TOPICS:")
        print("-" * 80)
        for i, topic in enumerate(result.key_topics, 1):
            relevance_bar = "█" * int(topic.relevance * 10)
            print(f"{i}. {topic.topic:<30} {relevance_bar} ({topic.relevance:.1%})")
        
        # Display sentiment
        print("\n😊 SENTIMENT:")
        print("-" * 80)
        sentiment_emoji = {
            "positive": "😊",
            "neutral": "😐",
            "negative": "😞"
        }.get(result.sentiment.overall, "❓")
        print(f"Overall: {sentiment_emoji} {result.sentiment.overall.upper()}")
        print(f"Score: {result.sentiment.score:+.2f} (-1 to +1)")
        
        # Display company values alignment
        if result.company_values_alignment:
            print("\n🎯 COMPANY VALUES ALIGNMENT:")
            print("-" * 80)
            print(f"Overall: {result.company_values_alignment.overall_alignment:.1%}")
            print("\nBreakdown:")
            for value in result.company_values_alignment.values:
                score_bar = "█" * int(value.score * 10)
                print(f"\n  {value.value}: {score_bar} ({value.score:.1%})")
                if value.examples:
                    print(f"  Examples:")
                    for example in value.examples[:2]:  # Show first 2
                        print(f"    - \"{example[:100]}...\"" if len(example) > 100 else f"    - \"{example}\"")
        
        # Test communication insights
        print("\n" + "=" * 80)
        print("💬 COMMUNICATION INSIGHTS")
        print("=" * 80)
        
        insights = await adapter.generate_communication_insights(
            transcript_text=transcript_text,
            talk_time_percentage=65.0,  # Example metric
            interruptions=3,  # Example metric
            num_speakers=2,
            duration_minutes=26.5
        )
        
        print(insights)
        
        print("\n✅ TEST COMPLETE!")
        
    except Exception as e:
        print(f"\n❌ Error during analysis: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(test_llm_analysis())

