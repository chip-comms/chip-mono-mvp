/**
 * Configuration
 * Environment variables and app settings
 */

import type { Config } from './types';

export const config: Config = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  maxFileSizeMB: 200,
  supportedFormats: [
    'video/mp4',
    'video/webm',
    'video/quicktime', // .mov
    'audio/mpeg',      // .mp3
    'audio/wav',
    'audio/mp4',       // .m4a
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
if (!config.openaiApiKey && process.env.NODE_ENV !== 'development') {
  console.warn('⚠️  OPENAI_API_KEY is not set');
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.openaiApiKey) {
    errors.push('OPENAI_API_KEY is required');
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

