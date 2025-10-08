/**
 * AI Provider Base Interface
 * Defines the contract that all AI providers must implement
 */

import type {
  Transcript,
  ActionItem,
  KeyTopic,
  Sentiment,
  CompanyValue,
} from '../../types';

export interface AnalysisResult {
  summary: string;
  actionItems: ActionItem[];
  keyTopics: KeyTopic[];
  sentiment: Sentiment;
  companyValuesAlignment?: {
    overallAlignment: number;
    values: CompanyValue[];
  };
}

export interface AIProvider {
  /**
   * The name of the AI provider
   */
  name: string;

  /**
   * Check if this provider is available (has valid API key)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Analyze a transcript and generate insights
   */
  analyzeTranscript(
    transcript: Transcript,
    companyValues: string[]
  ): Promise<AnalysisResult>;

  /**
   * Generate communication insights from transcript data
   */
  generateCommunicationInsights(
    transcript: Transcript,
    talkTimePercentage: number,
    interruptions: number
  ): Promise<string>;
}

/**
 * Base class for AI providers with common utilities
 */
export abstract class BaseAIProvider implements AIProvider {
  protected apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  abstract name: string;

  async isAvailable(): Promise<boolean> {
    return !!(this.apiKey && this.apiKey !== '' && this.apiKey.length > 10);
  }

  abstract analyzeTranscript(
    transcript: Transcript,
    companyValues: string[]
  ): Promise<AnalysisResult>;

  abstract generateCommunicationInsights(
    transcript: Transcript,
    talkTimePercentage: number,
    interruptions: number
  ): Promise<string>;

  /**
   * Helper method to truncate long transcripts if needed
   */
  protected truncateTranscript(
    transcript: Transcript,
    maxLength: number = 50000
  ): string {
    const fullText = transcript.fullText;
    if (fullText.length <= maxLength) {
      return fullText;
    }

    // Truncate to maxLength but break at word boundaries
    const truncated = fullText.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    return truncated.substring(0, lastSpaceIndex) + '... [truncated]';
  }

  /**
   * Helper method to format company values for prompts
   */
  protected formatCompanyValues(values: string[]): string {
    return values.map((value, index) => `${index + 1}. ${value}`).join('\n');
  }
}
