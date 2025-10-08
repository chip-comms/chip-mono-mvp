/**
 * Configuration
 * Environment variables and app settings
 */

import type { Config } from './types';

export const config: Config = {
  // AI Provider Configuration
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  // Preferred AI provider (auto, openai, gemini, anthropic)
  aiProvider:
    (process.env.AI_PROVIDER as 'auto' | 'openai' | 'gemini' | 'anthropic') ||
    'auto',

  maxFileSizeMB: 200,
  supportedFormats: [
    'video/mp4',
    'video/webm',
    'video/quicktime', // .mov
    'audio/mpeg', // .mp3
    'audio/wav',
    'audio/mp4', // .m4a
  ],
  // Default company values for prototype
  // In production, users would configure their own values
  companyValues: [
    'Collaboration',
    'Innovation',
    'Customer Focus',
    'Accountability',
    'Transparency',
  ],
};

// Validation
if (
  !config.openaiApiKey &&
  !config.geminiApiKey &&
  process.env.NODE_ENV !== 'development'
) {
  console.warn(
    '⚠️  No AI provider API key is set (OPENAI_API_KEY or GEMINI_API_KEY)'
  );
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.openaiApiKey && !config.geminiApiKey && !config.anthropicApiKey) {
    errors.push(
      'At least one AI provider API key is required (OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY)'
    );
  }

  if (config.maxFileSizeMB <= 0) {
    errors.push('maxFileSizeMB must be positive');
  }

  if (config.supportedFormats.length === 0) {
    errors.push('At least one format must be supported');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
