/**
 * OpenAI AI Provider
 * Uses GPT-4o-mini for analysis
 */

import OpenAI from 'openai';
import { BaseAIProvider, type AnalysisResult } from './base';
import type { Transcript } from '../../types';

export class OpenAIProvider extends BaseAIProvider {
  name = 'OpenAI';
  private client: OpenAI;

  constructor(apiKey: string) {
    super(apiKey);
    this.client = new OpenAI({ apiKey });
  }

  async analyzeTranscript(
    transcript: Transcript,
    companyValues: string[]
  ): Promise<AnalysisResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI meeting analyst. Analyze transcripts and provide structured insights in JSON format.`,
          },
          {
            role: 'user',
            content: `
Analyze this meeting transcript and provide insights in JSON format.

TRANSCRIPT:
${this.truncateTranscript(transcript)}

COMPANY VALUES TO ANALYZE:
${this.formatCompanyValues(companyValues)}

Please provide a JSON response with exactly this structure:
{
  "summary": "A concise 2-3 sentence summary of the meeting",
  "actionItems": [
    {
      "text": "Specific action item",
      "priority": "high|medium|low"
    }
  ],
  "keyTopics": [
    {
      "topic": "Topic name",
      "relevance": 0.8
    }
  ],
  "sentiment": {
    "overall": "positive|neutral|negative",
    "score": 0.2
  },
  "companyValuesAlignment": {
    "overallAlignment": 0.7,
    "values": [
      {
        "value": "Company value name",
        "score": 0.8,
        "examples": ["Quote from transcript showing this value"]
      }
    ]
  }
}

Ensure all scores are between 0 and 1, and sentiment score is between -1 and 1.
Provide only valid JSON, no other text.
`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON response
      const analysis = JSON.parse(content.trim());

      return {
        summary: analysis.summary || 'No summary available',
        actionItems: analysis.actionItems || [],
        keyTopics: analysis.keyTopics || [],
        sentiment: analysis.sentiment || { overall: 'neutral', score: 0 },
        companyValuesAlignment: analysis.companyValuesAlignment,
      };
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      throw new Error(
        `Failed to analyze transcript with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async generateCommunicationInsights(
    transcript: Transcript,
    talkTimePercentage: number,
    interruptions: number
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a communication coach providing constructive meeting insights.',
          },
          {
            role: 'user',
            content: `
Analyze the communication patterns in this meeting transcript and provide insights.

TRANSCRIPT:
${this.truncateTranscript(transcript, 30000)}

COMMUNICATION METRICS:
- Talk time percentage: ${talkTimePercentage}%
- Number of interruptions: ${interruptions}
- Number of speakers: ${transcript.speakers.length}
- Meeting duration: ${Math.round(transcript.durationSeconds / 60)} minutes

Provide 2-3 sentences with actionable communication insights focusing on:
1. Speaking time balance
2. Interaction patterns
3. Recommendations for improvement

Be concise and constructive.
`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      return (
        response.choices[0]?.message?.content?.trim() ||
        'Unable to generate communication insights at this time.'
      );
    } catch (error) {
      console.error('OpenAI insights error:', error);
      return 'Unable to generate communication insights at this time.';
    }
  }
}
