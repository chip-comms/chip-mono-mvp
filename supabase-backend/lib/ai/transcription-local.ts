/**
 * Local Whisper Transcription using whisper.cpp
 * Free alternative to OpenAI's API
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import type { TranscriptionResult, Speaker } from '../types';

const execAsync = promisify(exec);

/**
 * Ensure whisper model is downloaded
 */
async function ensureModel(): Promise<string> {
  const homeDir = os.homedir();
  const modelsDir = path.join(homeDir, '.whisper-models');
  const modelPath = path.join(modelsDir, 'ggml-base.en.bin');

  try {
    // Check if model exists
    await fs.access(modelPath);
    return modelPath;
  } catch {
    // Create models directory
    await fs.mkdir(modelsDir, { recursive: true });

    // Download base English model
    console.log('📥 Downloading Whisper base model (74MB)...');
    const downloadUrl =
      'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';
    const downloadCommand = `curl -L "${downloadUrl}" -o "${modelPath}"`;

    await execAsync(downloadCommand, {
      timeout: 300000, // 5 minutes
    });

    console.log('✅ Model downloaded successfully');
    return modelPath;
  }
}

/**
 * Check if whisper.cpp is installed
 */
export async function isWhisperInstalled(): Promise<boolean> {
  try {
    // Check for whisper-cli (from whisper-cpp package)
    await execAsync('which whisper-cli');
    return true;
  } catch {
    try {
      // Fallback: check for whisper (from pip install openai-whisper)
      await execAsync('which whisper');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Install whisper.cpp via Homebrew
 */
export async function installWhisper(): Promise<void> {
  console.log('Installing whisper.cpp via Homebrew...');
  try {
    await execAsync('brew install whisper-cpp');
    console.log('✅ whisper.cpp installed successfully');
  } catch (error) {
    throw new Error(`Failed to install whisper.cpp: ${error}`);
  }
}

/**
 * Transcribe audio using local whisper.cpp
 */
export async function transcribeAudioLocal(
  audioFile: File
): Promise<TranscriptionResult> {
  // Check if whisper is installed
  const isInstalled = await isWhisperInstalled();
  if (!isInstalled) {
    console.log('whisper.cpp not found. Installing...');
    await installWhisper();
  }

  // Save audio file to temporary location
  const tempDir = os.tmpdir();
  const tempAudioPath = path.join(tempDir, `audio-${Date.now()}.mp3`);

  // Declare output files outside try block for cleanup
  const outputPath = tempAudioPath.replace('.mp3', '.txt');
  const outputFile = tempAudioPath.replace('.mp3', '');

  try {
    // Write audio file
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    await fs.writeFile(tempAudioPath, buffer);

    // Download base model if it doesn't exist
    const modelPath = await ensureModel();

    const command = `whisper-cli -f "${tempAudioPath}" -m "${modelPath}" --output-txt --output-srt -l auto --print-progress -of "${outputFile}"`;

    await execAsync(command, {
      timeout: 300000, // 5 minutes
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    // Read the transcription result
    let transcriptionText = '';
    let segments: Array<{
      start: number;
      end: number;
      text: string;
      speaker?: string;
    }> = [];

    try {
      // Try to read SRT file first (has timestamps)
      const srtPath = outputFile + '.srt';
      const srtContent = await fs.readFile(srtPath, 'utf-8');
      segments = parseSrtOutput(srtContent);
      transcriptionText = segments.map((s) => s.text).join(' ');
    } catch {
      try {
        // Fallback to TXT file
        transcriptionText = await fs.readFile(outputPath, 'utf-8');
        segments = parseWhisperOutput(transcriptionText);
      } catch {
        throw new Error('Could not read transcription output');
      }
    }

    // Simple speaker detection (can be improved)
    const speakers = detectSpeakers(segments);

    // Calculate duration from segments
    const durationSeconds =
      segments.length > 0 ? segments[segments.length - 1].end : 0;

    return {
      text: transcriptionText,
      segments,
      speakers,
      durationSeconds,
      confidence: 0.85, // whisper.cpp doesn't provide confidence scores
    };
  } catch (error) {
    throw new Error(`Local transcription failed: ${error}`);
  } finally {
    // Clean up temp files
    try {
      await fs.unlink(tempAudioPath);
      // Clean up output files
      await fs.unlink(outputFile + '.txt').catch(() => {});
      await fs.unlink(outputFile + '.srt').catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Parse SRT output into segments
 */
function parseSrtOutput(srtContent: string): Array<{
  start: number;
  end: number;
  text: string;
  speaker?: string;
}> {
  const segments = [];
  const blocks = srtContent.trim().split('\n\n');

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      // Parse timestamp line (format: 00:00:01,000 --> 00:00:03,500)
      const timestampLine = lines[1];
      const timestampMatch = timestampLine.match(
        /(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/
      );

      if (timestampMatch) {
        const [, startH, startM, startS, startMs, endH, endM, endS, endMs] =
          timestampMatch;
        const start =
          parseInt(startH) * 3600 +
          parseInt(startM) * 60 +
          parseInt(startS) +
          parseInt(startMs) / 1000;
        const end =
          parseInt(endH) * 3600 +
          parseInt(endM) * 60 +
          parseInt(endS) +
          parseInt(endMs) / 1000;

        // Get text (remaining lines)
        const text = lines.slice(2).join(' ').trim();

        if (text) {
          segments.push({ start, end, text });
        }
      }
    }
  }

  return segments;
}

/**
 * Parse whisper.cpp output into segments
 */
function parseWhisperOutput(text: string): Array<{
  start: number;
  end: number;
  text: string;
  speaker?: string;
}> {
  // This is a simplified parser - whisper.cpp output format may vary
  const lines = text.split('\n').filter((line) => line.trim());
  const segments = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for timestamp patterns like [00:01.000 --> 00:05.000]
    const timestampMatch = line.match(
      /\[(\d{2}):(\d{2}\.\d{3}) --> (\d{2}):(\d{2}\.\d{3})\]/
    );

    if (timestampMatch) {
      const [, startMin, startSec, endMin, endSec] = timestampMatch;
      const start = parseInt(startMin) * 60 + parseFloat(startSec);
      const end = parseInt(endMin) * 60 + parseFloat(endSec);

      // Get the text (next line usually)
      const text = i + 1 < lines.length ? lines[i + 1].trim() : '';

      if (text) {
        segments.push({
          start,
          end,
          text,
        });
      }
    } else if (line.trim() && !line.includes('[') && segments.length === 0) {
      // If no timestamps found, treat as one segment
      segments.push({
        start: 0,
        end: 60, // estimate
        text: line.trim(),
      });
    }
  }

  // Fallback if no segments parsed
  if (segments.length === 0) {
    segments.push({
      start: 0,
      end: 60,
      text: text.replace(/\[.*?\]/g, '').trim(),
    });
  }

  return segments;
}

/**
 * Simple speaker detection based on pauses and patterns
 */
function detectSpeakers(
  segments: Array<{ start: number; end: number; text: string }>
): Speaker[] {
  // Very basic speaker detection - can be improved with actual speaker diarization
  const speakers: Speaker[] = [
    {
      id: 'speaker_1',
      name: 'Speaker 1',
      totalTime: 0,
      wordCount: 0,
    },
  ];

  // Calculate basic stats
  let totalWords = 0;
  let totalTime = 0;

  for (const segment of segments) {
    const words = segment.text.split(' ').length;
    const duration = segment.end - segment.start;

    totalWords += words;
    totalTime += duration;
  }

  speakers[0].wordCount = totalWords;
  speakers[0].totalTime = totalTime;

  return speakers;
}
