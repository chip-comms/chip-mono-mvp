/**
 * AI Analysis Module
 *
 * PORTABLE: Uses the AI adapter pattern to support multiple providers.
 * Works unchanged in both Node.js and Deno.
 *
 * No filesystem access, no Node.js-specific APIs.
 */

import { AIAdapter } from './ai-adapter';
import type { Transcript, Config } from '../types';
import type { AnalysisResult } from './providers/base';

// Export the AnalysisResult type for backward compatibility
export type { AnalysisResult } from './providers/base';

let aiAdapter: AIAdapter | null = null;

/**
 * Initialize the AI adapter with configuration
 */
function getAIAdapter(config: Config): AIAdapter {
  if (!aiAdapter) {
    aiAdapter = new AIAdapter(config);
  }
  return aiAdapter;
}

/**
 * Analyze transcript using the best available AI provider
 */
export async function analyzeTranscript(
  transcript: Transcript,
  apiKey: string, // Kept for backward compatibility but not used
  companyValues: string[] = []
): Promise<AnalysisResult> {
  // Get config from environment (this is a bit of a hack for backward compatibility)
  const config: Config = {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    aiProvider:
      (process.env.AI_PROVIDER as 'auto' | 'openai' | 'gemini' | 'anthropic') ||
      'auto',
    maxFileSizeMB: 200,
    supportedFormats: [],
    companyValues: companyValues,
  };

  const adapter = getAIAdapter(config);
  return adapter.analyzeTranscript(transcript, companyValues);
}

/**
 * Generate communication insights using the best available AI provider
 */
export async function generateCommunicationInsights(
  transcript: Transcript,
  talkTimePercentage: number,
  interruptions: number,
  apiKey: string // Kept for backward compatibility but not used
): Promise<string> {
  // Get config from environment
  const config: Config = {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    aiProvider:
      (process.env.AI_PROVIDER as 'auto' | 'openai' | 'gemini' | 'anthropic') ||
      'auto',
    maxFileSizeMB: 200,
    supportedFormats: [],
    companyValues: [],
  };

  const adapter = getAIAdapter(config);
  return adapter.generateCommunicationInsights(
    transcript,
    talkTimePercentage,
    interruptions
  );
}

/**
 * Get available AI providers
 */
export async function getAvailableAIProviders(): Promise<string[]> {
  const config: Config = {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    aiProvider: 'auto',
    maxFileSizeMB: 200,
    supportedFormats: [],
    companyValues: [],
  };

  const adapter = getAIAdapter(config);
  return adapter.getAvailableProviders();
}
