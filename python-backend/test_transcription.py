"""
Test script for transcription service.

Usage:
    python test_transcription.py
"""

import sys
from pathlib import Path
import time

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.audio.transcription import TranscriptionService


def test_transcription():
    """Test transcription with sample audio."""
    
    # Audio file path
    audio_path = Path("/tmp/test-audio.wav")
    
    if not audio_path.exists():
        print(f"❌ Audio file not found: {audio_path}")
        print("Extract audio first with:")
        print('  ffmpeg -i "recording-samples/Beau_Lauren (2024-06-20 15_06 GMT-4).mp4" -vn -acodec pcm_s16le -ar 16000 -ac 1 /tmp/test-audio.wav -y')
        return
    
    print("=" * 80)
    print("🎤 WHISPER.CPP TRANSCRIPTION TEST")
    print("=" * 80)
    
    # Initialize service
    print("\n📦 Initializing transcription service...")
    service = TranscriptionService(model_name="base.en")
    print(f"✅ Model path: {service.model_path}")
    print(f"✅ Whisper CLI: {service._check_whisper_installed()}")
    
    # Transcribe
    print(f"\n🎤 Transcribing: {audio_path}")
    print("⏱️ This may take 30-120 seconds...")
    
    start_time = time.time()
    result = service.transcribe(audio_path, language="en")
    elapsed = time.time() - start_time
    
    # Display results
    print("\n" + "=" * 80)
    print("✅ TRANSCRIPTION COMPLETE!")
    print("=" * 80)
    print(f"\n⏱️ Processing time: {elapsed:.1f} seconds")
    print(f"📝 Audio duration: {result['duration']:.1f} seconds ({result['duration']/60:.1f} minutes)")
    print(f"📄 Segments: {len(result['segments'])}")
    print(f"📖 Total words: {len(result['text'].split())}")
    print(f"🗣️ Language: {result['language']}")
    
    # Show first few segments
    print("\n" + "-" * 80)
    print("📝 FIRST 5 SEGMENTS:")
    print("-" * 80)
    for i, segment in enumerate(result['segments'][:5]):
        timestamp = f"[{segment['start']:.1f}s - {segment['end']:.1f}s]"
        print(f"{i+1}. {timestamp}: {segment['text']}")
    
    # Show full transcript preview
    print("\n" + "-" * 80)
    print("📖 FULL TRANSCRIPT (first 1000 chars):")
    print("-" * 80)
    print(result['text'][:1000])
    print("...")
    
    # Save to file
    output_path = Path("transcription_output.txt")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("FULL TRANSCRIPT\n")
        f.write("=" * 80 + "\n\n")
        f.write(result['text'])
        f.write("\n\n" + "=" * 80 + "\n")
        f.write("SEGMENTS WITH TIMESTAMPS\n")
        f.write("=" * 80 + "\n\n")
        for i, segment in enumerate(result['segments']):
            mins = int(segment['start'] // 60)
            secs = int(segment['start'] % 60)
            f.write(f"[{mins:02d}:{secs:02d}] {segment['text']}\n")
    
    print(f"\n💾 Full transcript saved to: {output_path}")
    print("\n✅ TEST COMPLETE!")


if __name__ == "__main__":
    test_transcription()

