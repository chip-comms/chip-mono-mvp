/**
 * Transcription Module
 * 
 * PORTABLE: This module uses only OpenAI APIs and standard JavaScript.
 * It will work unchanged in both Node.js and Deno.
 * 
 * No filesystem access, no Node.js-specific APIs.
 */

import OpenAI from 'openai';
import type { Transcript, TranscriptSegment } from '../types';

/**
 * Transcribe audio using OpenAI Whisper API
 * 
 * @param audioFile - Audio file as Blob or File
 * @param apiKey - OpenAI API key
 * @returns Structured transcript with speaker diarization
 */
export async function transcribeAudio(
  audioFile: File,
  apiKey: string
): Promise<Transcript> {
  const openai = new OpenAI({ apiKey });

  try {
    // Call Whisper API with word-level timestamps
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    // Parse response into structured format
    const segments: TranscriptSegment[] = [];
    const speakers = new Set<string>();
    let currentSpeaker = 'Speaker 1';
    let speakerCount = 1;

    // Process segments (Whisper provides timing info)
    if (response.words && response.words.length > 0) {
      let currentSegment: TranscriptSegment | null = null;
      const PAUSE_THRESHOLD = 1.5; // seconds - pause indicates speaker change

      for (let i = 0; i < response.words.length; i++) {
        const word = response.words[i];
        const nextWord = response.words[i + 1];

        // Start new segment
        if (!currentSegment) {
          currentSegment = {
            start: word.start,
            end: word.end,
            text: word.word,
            speaker: currentSpeaker,
          };
          speakers.add(currentSpeaker);
          continue;
        }

        // Check for speaker change (based on pause duration)
        const pause = nextWord ? (nextWord.start - word.end) : 0;
        if (pause > PAUSE_THRESHOLD && nextWord) {
          // Complete current segment
          currentSegment.end = word.end;
          currentSegment.text = currentSegment.text.trim();
          segments.push(currentSegment);

          // Start new speaker
          speakerCount++;
          currentSpeaker = `Speaker ${speakerCount}`;
          currentSegment = {
            start: nextWord.start,
            end: nextWord.end,
            text: nextWord.word,
            speaker: currentSpeaker,
          };
          speakers.add(currentSpeaker);
          i++; // Skip the next word since we already processed it
        } else {
          // Continue current segment
          currentSegment.text += ' ' + word.word;
          currentSegment.end = word.end;
        }
      }

      // Push final segment
      if (currentSegment) {
        currentSegment.text = currentSegment.text.trim();
        segments.push(currentSegment);
      }
    } else {
      // Fallback if no word-level timing (shouldn't happen with verbose_json)
      segments.push({
        start: 0,
        end: response.duration || 0,
        text: response.text,
        speaker: 'Speaker 1',
      });
      speakers.add('Speaker 1');
    }

    return {
      segments,
      fullText: response.text,
      durationSeconds: response.duration || 0,
      speakers: Array.from(speakers),
    };
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error(
      `Failed to transcribe audio: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Format transcript as readable text with timestamps and speakers
 */
export function formatTranscript(transcript: Transcript): string {
  return transcript.segments
    .map((segment) => {
      const timestamp = formatTimestamp(segment.start);
      return `[${timestamp}] ${segment.speaker}: ${segment.text}`;
    })
    .join('\n\n');
}

/**
 * Format seconds as MM:SS timestamp
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get transcript text for a specific speaker
 */
export function getSpeakerText(transcript: Transcript, speaker: string): string {
  return transcript.segments
    .filter((s) => s.speaker === speaker)
    .map((s) => s.text)
    .join(' ');
}

/**
 * Calculate total duration for a specific speaker
 */
export function getSpeakerDuration(transcript: Transcript, speaker: string): number {
  return transcript.segments
    .filter((s) => s.speaker === speaker)
    .reduce((total, segment) => total + (segment.end - segment.start), 0);
}

