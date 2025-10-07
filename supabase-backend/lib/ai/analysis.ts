/**
 * Analysis Module
 *
 * PORTABLE: Uses only OpenAI APIs and standard JavaScript.
 * Works unchanged in both Node.js and Deno.
 */

import OpenAI from 'openai';
import type {
  Transcript,
  ActionItem,
  KeyTopic,
  Sentiment,
  CompanyValue,
} from '../types';

interface AnalysisResult {
  summary: string;
  actionItems: ActionItem[];
  keyTopics: KeyTopic[];
  sentiment: Sentiment;
}

/**
 * Analyze transcript using GPT-4o-mini
 */
export async function analyzeTranscript(
  transcript: Transcript,
  apiKey: string,
  companyValues: string[] = []
): Promise<
  AnalysisResult & {
    companyValuesAlignment?: {
      overallAlignment: number;
      values: CompanyValue[];
    };
  }
> {
  const openai = new OpenAI({ apiKey });

  // Prepare the transcript text
  const transcriptText = transcript.segments
    .map((s) => `${s.speaker}: ${s.text}`)
    .join('\n');

  try {
    // Call GPT-4o-mini with structured output
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert meeting analyst. Analyze meeting transcripts and provide structured insights.
          
Guidelines:
- Be concise and actionable
- Extract specific, measurable action items
- Identify the most relevant topics discussed
- Provide honest sentiment assessment
- Use quotes and examples from the transcript`,
        },
        {
          role: 'user',
          content: `Analyze this meeting transcript and provide:

1. **Summary**: A concise 3-5 paragraph summary of the key discussion points, decisions made, and overall flow of the meeting.

2. **Action Items**: Extract specific, actionable tasks mentioned or implied. For each action item:
   - Provide clear, specific task description
   - Assign priority (high/medium/low) based on urgency and importance discussed
   - Include context from the conversation

3. **Key Topics**: Identify 5-7 main topics or themes discussed. For each:
   - Topic name (2-4 words)
   - Relevance score (0.0-1.0) based on time spent and emphasis
   
4. **Sentiment**: Analyze the overall tone and mood:
   - Overall sentiment (positive/neutral/negative)
   - Sentiment score (-1.0 to 1.0)
   - Brief justification

Transcript:
${transcriptText}

Respond in JSON format:
{
  "summary": "...",
  "actionItems": [{"text": "...", "priority": "high|medium|low"}],
  "keyTopics": [{"topic": "...", "relevance": 0.0-1.0}],
  "sentiment": {"overall": "positive|neutral|negative", "score": -1.0 to 1.0, "justification": "..."}
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent output
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from GPT-4');
    }

    const analysis = JSON.parse(content);

    // Validate and structure the response
    const result: AnalysisResult = {
      summary: analysis.summary || 'No summary available',
      actionItems: (analysis.actionItems || []).map(
        (item: { text: string; priority?: string }) => ({
          text: item.text,
          priority: item.priority || 'medium',
        })
      ),
      keyTopics: (analysis.keyTopics || []).map(
        (topic: { topic: string; relevance?: number }) => ({
          topic: topic.topic,
          relevance: topic.relevance || 0.5,
        })
      ),
      sentiment: {
        overall: analysis.sentiment?.overall || 'neutral',
        score: analysis.sentiment?.score || 0,
      },
    };

    // If company values provided, analyze alignment
    if (companyValues.length > 0) {
      const valuesAlignment = await analyzeCompanyValues(
        transcriptText,
        companyValues,
        openai
      );
      return { ...result, companyValuesAlignment: valuesAlignment };
    }

    return result;
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error(
      `Failed to analyze transcript: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Analyze how well the meeting demonstrates company values
 */
async function analyzeCompanyValues(
  transcriptText: string,
  companyValues: string[],
  openai: OpenAI
): Promise<{ overallAlignment: number; values: CompanyValue[] }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing how well communication aligns with company values.
For each value, find specific examples and quotes from the transcript that demonstrate (or lack) that value.`,
        },
        {
          role: 'user',
          content: `Analyze how well this meeting transcript demonstrates these company values: ${companyValues.join(', ')}

For EACH value, provide:
1. A score from 0.0 to 1.0 (0 = not demonstrated, 1 = strongly demonstrated)
2. 1-3 specific quotes or examples from the transcript that show this value
3. If the value wasn't demonstrated, note that explicitly

Transcript:
${transcriptText}

Respond in JSON format:
{
  "values": [
    {
      "value": "Value Name",
      "score": 0.0-1.0,
      "examples": ["Quote 1...", "Quote 2..."]
    }
  ]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from GPT-4 for values analysis');
    }

    const analysis = JSON.parse(content);
    const values: CompanyValue[] = (analysis.values || []).map(
      (v: { value: string; score?: number; examples?: string[] }) => ({
        value: v.value,
        score: v.score || 0,
        examples: v.examples || [],
      })
    );

    // Calculate overall alignment (average of all scores)
    const overallAlignment =
      values.reduce((sum, v) => sum + v.score, 0) / values.length || 0;

    return { overallAlignment, values };
  } catch (error) {
    console.error('Company values analysis error:', error);
    // Return default if analysis fails
    return {
      overallAlignment: 0.5,
      values: companyValues.map((value) => ({
        value,
        score: 0.5,
        examples: ['Analysis unavailable'],
      })),
    };
  }
}

/**
 * Generate insights about communication patterns
 */
export async function generateCommunicationInsights(
  transcript: Transcript,
  talkTimePercentage: number,
  interruptions: number,
  apiKey: string
): Promise<string> {
  const openai = new OpenAI({ apiKey });

  const transcriptText = transcript.segments
    .map((s) => `${s.speaker}: ${s.text}`)
    .join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a communication coach providing helpful, actionable feedback.`,
        },
        {
          role: 'user',
          content: `Based on this meeting analysis, provide 2-3 brief, actionable insights:

Talk time: ${talkTimePercentage.toFixed(1)}%
Interruptions: ${interruptions}

Transcript snippet:
${transcriptText.substring(0, 1000)}...

Provide constructive, specific feedback in 2-3 sentences.`,
        },
      ],
      max_tokens: 150,
      temperature: 0.5,
    });

    return response.choices[0].message.content || 'No insights available';
  } catch (error) {
    console.error('Insights generation error:', error);
    return 'Unable to generate insights at this time.';
  }
}
