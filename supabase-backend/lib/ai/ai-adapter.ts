/**
 * AI Adapter
 * Manages multiple AI providers and automatically selects the best available one
 */

import type { AIProvider, AnalysisResult } from './providers/base';
import { GeminiProvider } from './providers/gemini';
import { OpenAIProvider } from './providers/openai';
import type { Transcript, Config } from '../types';

export class AIAdapter {
  private providers: AIProvider[] = [];
  private selectedProvider: AIProvider | null = null;

  constructor(private config: Config) {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize available providers based on configuration
    if (this.config.geminiApiKey) {
      this.providers.push(new GeminiProvider(this.config.geminiApiKey));
    }

    if (this.config.openaiApiKey) {
      this.providers.push(new OpenAIProvider(this.config.openaiApiKey));
    }

    // Add more providers here as needed
    // if (this.config.anthropicApiKey) {
    //   this.providers.push(new AnthropicProvider(this.config.anthropicApiKey));
    // }
  }

  /**
   * Get the best available AI provider
   */
  async getProvider(): Promise<AIProvider> {
    if (this.selectedProvider) {
      return this.selectedProvider;
    }

    // Check provider preference
    if (this.config.aiProvider !== 'auto') {
      const preferredProvider = this.providers.find(
        (p) => p.name.toLowerCase() === this.config.aiProvider.toLowerCase()
      );

      if (preferredProvider && (await preferredProvider.isAvailable())) {
        console.log(
          `🤖 Using preferred AI provider: ${preferredProvider.name}`
        );
        this.selectedProvider = preferredProvider;
        return preferredProvider;
      }
    }

    // Auto-select best available provider
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        console.log(`🤖 Auto-selected AI provider: ${provider.name}`);
        this.selectedProvider = provider;
        return provider;
      }
    }

    throw new Error(
      'No AI provider available. Please configure an API key for OpenAI, Gemini, or another supported provider.'
    );
  }

  /**
   * Get list of available providers
   */
  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        available.push(provider.name);
      }
    }
    return available;
  }

  /**
   * Analyze transcript using the best available provider
   */
  async analyzeTranscript(
    transcript: Transcript,
    companyValues: string[]
  ): Promise<AnalysisResult> {
    const provider = await this.getProvider();
    return provider.analyzeTranscript(transcript, companyValues);
  }

  /**
   * Generate communication insights using the best available provider
   */
  async generateCommunicationInsights(
    transcript: Transcript,
    talkTimePercentage: number,
    interruptions: number
  ): Promise<string> {
    const provider = await this.getProvider();
    return provider.generateCommunicationInsights(
      transcript,
      talkTimePercentage,
      interruptions
    );
  }

  /**
   * Reset provider selection (for testing or switching providers)
   */
  resetProvider() {
    this.selectedProvider = null;
  }
}
