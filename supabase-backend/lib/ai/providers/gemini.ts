/**
 * Google Gemini AI Provider
 * Uses Gemini Flash for fast, cost-effective analysis
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider, type AnalysisResult } from './base';
import type { Transcript } from '../../types';

export class GeminiProvider extends BaseAIProvider {
  name = 'Gemini';
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    super(apiKey);
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async analyzeTranscript(
    transcript: Transcript,
    companyValues: string[]
  ): Promise<AnalysisResult> {
    try {
      // Use Gemini Flash Latest (cheapest stable model)
      const model = this.client.getGenerativeModel({
        model: 'gemini-flash-latest',
      });

      const prompt = `
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
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();

      // Clean up markdown code blocks if present
      if (text.startsWith('```json')) {
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Parse JSON response
      const analysis = JSON.parse(text.trim());

      return {
        summary: analysis.summary || 'No summary available',
        actionItems: analysis.actionItems || [],
        keyTopics: analysis.keyTopics || [],
        sentiment: analysis.sentiment || { overall: 'neutral', score: 0 },
        companyValuesAlignment: analysis.companyValuesAlignment,
      };
    } catch (error) {
      console.error('Gemini analysis error:', error);
      throw new Error(
        `Failed to analyze transcript with Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async generateCommunicationInsights(
    transcript: Transcript,
    talkTimePercentage: number,
    interruptions: number
  ): Promise<string> {
    try {
      const model = this.client.getGenerativeModel({
        model: 'gemini-flash-latest',
      });

      const prompt = `
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
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Gemini insights error:', error);
      return 'Unable to generate communication insights at this time.';
    }
  }
}
