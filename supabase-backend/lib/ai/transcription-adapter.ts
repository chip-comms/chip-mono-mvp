/**
 * Transcription Adapter
 * Chooses between OpenAI Whisper API or Local Whisper based on configuration
 */

import { transcribeAudio as transcribeWithOpenAI } from './transcription';
import {
  transcribeAudioLocal,
  isWhisperInstalled,
} from './transcription-local';
import type { Transcript } from '../types';

export type TranscriptionMode = 'openai' | 'local' | 'auto';

/**
 * Transcribe audio with automatic fallback
 */
export async function transcribeAudio(
  audioFile: File,
  apiKey?: string,
  mode: TranscriptionMode = 'auto'
): Promise<Transcript> {
  // Auto mode: try OpenAI first if API key available, otherwise use local
  if (mode === 'auto') {
    if (apiKey && apiKey !== 'sk-your-key-here' && apiKey.length > 20) {
      console.log('🤖 Using OpenAI Whisper API (auto-selected)');
      mode = 'openai';
    } else {
      console.log('🏠 Using local Whisper (auto-selected)');
      mode = 'local';
    }
  }

  try {
    if (mode === 'openai') {
      if (!apiKey || apiKey === 'sk-your-key-here') {
        throw new Error('OpenAI API key required for API mode');
      }
      console.log('🤖 Transcribing with OpenAI Whisper API...');
      return await transcribeWithOpenAI(audioFile, apiKey);
    } else if (mode === 'local') {
      console.log('🏠 Transcribing with local Whisper...');

      // Check if local whisper is available
      const isInstalled = await isWhisperInstalled();
      if (!isInstalled) {
        console.log(
          '⚠️  Local Whisper not installed. Install with: brew install whisper-cpp'
        );
        throw new Error(
          'Local Whisper not available. Please install whisper-cpp or provide OpenAI API key.'
        );
      }

      // Convert to TranscriptionResult and adapt to Transcript
      const result = await transcribeAudioLocal(audioFile);

      // Convert local format to our standard Transcript format
      return {
        segments: result.segments.map(
          (seg: {
            start: number;
            end: number;
            text: string;
            speaker?: string;
          }) => ({
            start: seg.start,
            end: seg.end,
            text: seg.text,
            speaker: seg.speaker || 'Speaker 1',
          })
        ),
        fullText: result.text,
        durationSeconds: result.durationSeconds,
        speakers: result.speakers.map((s: { name: string }) => s.name),
      };
    }

    throw new Error(`Unsupported transcription mode: ${mode}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    // If OpenAI fails and we haven't tried local, try local as fallback
    if (mode === 'openai' && errorMsg.includes('API key')) {
      console.log('🔄 OpenAI failed, trying local Whisper as fallback...');
      return transcribeAudio(audioFile, undefined, 'local');
    }

    throw error;
  }
}

/**
 * Get available transcription options
 */
export async function getAvailableTranscriptionModes(apiKey?: string): Promise<{
  openai: boolean;
  local: boolean;
  recommended: TranscriptionMode;
}> {
  const hasValidApiKey = !!(
    apiKey &&
    apiKey !== 'sk-your-key-here' &&
    apiKey.length > 20
  );
  const hasLocalWhisper = await isWhisperInstalled();

  let recommended: TranscriptionMode = 'auto';
  if (hasValidApiKey) {
    recommended = 'openai'; // OpenAI is more accurate
  } else if (hasLocalWhisper) {
    recommended = 'local';
  }

  return {
    openai: hasValidApiKey,
    local: hasLocalWhisper,
    recommended,
  };
}
