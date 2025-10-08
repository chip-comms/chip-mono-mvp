"""
Transcription Service using whisper.cpp

Status: ✅ IMPLEMENTED

This service handles speech-to-text conversion with timestamps.
Uses whisper.cpp (local, free, fast) - same as TypeScript backend.
"""

from typing import Optional, List, Dict, Any
from pathlib import Path
import logging
import subprocess
import os
import re

logger = logging.getLogger(__name__)


class TranscriptionService:
    """
    whisper.cpp-based transcription service.
    
    Features:
    - Local processing (no API calls)
    - Fast and free
    - Segment timestamps
    - Multiple languages
    """
    
    def __init__(
        self,
        model_name: str = "base.en"
    ):
        """
        Initialize transcription service.
        
        Args:
            model_name: Model name (tiny.en, base.en, small.en, etc.)
        """
        self.model_name = model_name
        self.model_path = self._get_model_path()
        
        logger.info(f"✅ Initializing TranscriptionService with whisper.cpp ({model_name})")
    
    def _get_model_path(self) -> Path:
        """Get path to whisper model."""
        home_dir = Path.home()
        models_dir = home_dir / ".whisper-models"
        model_path = models_dir / f"ggml-{self.model_name}.bin"
        
        if not model_path.exists():
            raise FileNotFoundError(
                f"Model not found at {model_path}. "
                f"Download with: curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{self.model_name}.bin -o {model_path}"
            )
        
        return model_path
    
    def _check_whisper_installed(self) -> bool:
        """Check if whisper-cli is installed."""
        try:
            subprocess.run(
                ["which", "whisper-cli"],
                capture_output=True,
                check=True
            )
            return True
        except subprocess.CalledProcessError:
            return False
    
    def transcribe(
        self,
        audio_path: Path,
        language: Optional[str] = None,
        batch_size: int = 16
    ) -> Dict[str, Any]:
        """
        Transcribe audio file to text with timestamps.
        
        Args:
            audio_path: Path to audio file
            language: Language code (e.g. 'en', 'es') or 'auto' for detection
            batch_size: Not used (kept for API compatibility)
        
        Returns:
            Dictionary with:
                - text: Full transcript
                - segments: List of segments with timestamps
                - language: Detected/specified language
                - duration: Audio duration in seconds
        """
        # Check if whisper-cli is installed
        if not self._check_whisper_installed():
            raise RuntimeError(
                "whisper-cli not found. Install with: brew install whisper-cpp"
            )
        
        logger.info(f"🎤 Transcribing: {audio_path}")
        
        # Prepare output file path
        output_base = audio_path.parent / audio_path.stem
        srt_path = output_base.with_suffix('.srt')
        txt_path = output_base.with_suffix('.txt')
        
        try:
            # Build whisper command
            lang_flag = language or "auto"
            command = [
                "whisper-cli",
                "-f", str(audio_path),
                "-m", str(self.model_path),
                "--output-srt",
                "--output-txt",
                "-l", lang_flag,
                "--print-progress",
                "-of", str(output_base)
            ]
            
            logger.info(f"Running: {' '.join(command[:5])}...")
            
            # Run whisper-cli
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"whisper-cli failed: {result.stderr}")
            
            # Parse SRT file for segments with timestamps
            segments = []
            full_text = ""
            
            if srt_path.exists():
                segments = self._parse_srt(srt_path)
                full_text = " ".join(s["text"] for s in segments)
                logger.info(f"✅ Parsed {len(segments)} segments from SRT")
            elif txt_path.exists():
                # Fallback to text file
                with open(txt_path, 'r', encoding='utf-8') as f:
                    full_text = f.read().strip()
                segments = [{
                    "start": 0.0,
                    "end": 60.0,  # Estimate
                    "text": full_text
                }]
            else:
                raise RuntimeError("No output files generated")
            
            # Calculate duration
            duration = segments[-1]["end"] if segments else 0.0
            
            logger.info(f"✅ Transcription complete: {len(segments)} segments, {duration:.1f}s")
            
            return {
                "text": full_text,
                "segments": segments,
                "language": language or "en",
                "duration": duration
            }
            
        except subprocess.TimeoutExpired:
            logger.error("❌ Transcription timed out")
            raise RuntimeError("Transcription timed out after 5 minutes")
        except Exception as e:
            logger.error(f"❌ Transcription failed: {e}")
            raise
        finally:
            # Cleanup output files
            for path in [srt_path, txt_path]:
                if path.exists():
                    try:
                        path.unlink()
                    except:
                        pass
    
    def _parse_srt(self, srt_path: Path) -> List[Dict[str, Any]]:
        """Parse SRT file into segments."""
        segments = []
        
        with open(srt_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split by double newlines
        blocks = content.strip().split('\n\n')
        
        for block in blocks:
            lines = block.split('\n')
            if len(lines) >= 3:
                # Parse timestamp line (format: 00:00:01,000 --> 00:00:03,500)
                timestamp_line = lines[1]
                match = re.match(
                    r'(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})',
                    timestamp_line
                )
                
                if match:
                    groups = match.groups()
                    start = (int(groups[0]) * 3600 + 
                            int(groups[1]) * 60 + 
                            int(groups[2]) + 
                            int(groups[3]) / 1000)
                    end = (int(groups[4]) * 3600 + 
                          int(groups[5]) * 60 + 
                          int(groups[6]) + 
                          int(groups[7]) / 1000)
                    
                    # Get text (remaining lines)
                    text = ' '.join(lines[2:]).strip()
                    
                    if text:
                        segments.append({
                            "start": start,
                            "end": end,
                            "text": text
                        })
        
        return segments
    
    def transcribe_with_words(
        self,
        audio_path: Path,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribe with segment timestamps.
        
        Note: whisper.cpp doesn't provide word-level timestamps,
        only segment-level. For word-level, use OpenAI API or WhisperX.
        """
        return self.transcribe(audio_path, language)
    
    def get_supported_languages(self) -> List[str]:
        """Get list of supported languages."""
        # Common languages supported by Whisper
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
            # ... Whisper supports 99 languages
        ]


# Example usage
"""
service = TranscriptionService(model_name="base.en")
result = service.transcribe(Path("meeting.wav"), language="en")

print(result["text"])
for segment in result["segments"]:
    print(f"[{segment['start']:.2f}s - {segment['end']:.2f}s]: {segment['text']}")
"""

