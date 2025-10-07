/**
 * Communication Metrics Module
 *
 * PORTABLE: Pure JavaScript calculations, no I/O.
 * Works unchanged in both Node.js and Deno.
 */

import type {
  Transcript,
  SpeakerStats,
  ResponseDelay,
  CommunicationMetrics,
} from '../types';

/**
 * Calculate comprehensive communication metrics from transcript
 */
export function calculateCommunicationMetrics(
  transcript: Transcript,
  userSpeaker: string = 'Speaker 1' // Assume user is first speaker
): Omit<CommunicationMetrics, 'companyValuesAlignment' | 'insights'> {
  // Calculate speaker stats
  const speakerBreakdown = calculateSpeakerStats(transcript);

  // Calculate talk time percentage for user
  const userStats = speakerBreakdown.find((s) => s.speaker === userSpeaker);
  const talkTimePercentage = userStats?.percentage || 0;

  // Calculate response delays
  const { delays, avgDelay, interruptions } = calculateResponseDelays(
    transcript,
    userSpeaker
  );

  return {
    talkTimePercentage,
    speakerBreakdown,
    averageResponseDelay: avgDelay,
    responseDelays: delays,
    interruptions,
  };
}

/**
 * Calculate statistics for each speaker
 */
export function calculateSpeakerStats(transcript: Transcript): SpeakerStats[] {
  const totalDuration = transcript.durationSeconds;
  const stats = new Map<string, { duration: number; wordCount: number }>();

  // Aggregate data per speaker
  for (const segment of transcript.segments) {
    const duration = segment.end - segment.start;
    const wordCount = segment.text.split(/\s+/).length;

    const current = stats.get(segment.speaker) || { duration: 0, wordCount: 0 };
    stats.set(segment.speaker, {
      duration: current.duration + duration,
      wordCount: current.wordCount + wordCount,
    });
  }

  // Convert to array with percentages
  return Array.from(stats.entries()).map(([speaker, data]) => ({
    speaker,
    durationSeconds: Math.round(data.duration * 10) / 10,
    wordCount: data.wordCount,
    percentage: Math.round((data.duration / totalDuration) * 100 * 10) / 10,
  }));
}

/**
 * Calculate response delays between speakers
 */
export function calculateResponseDelays(
  transcript: Transcript,
  userSpeaker: string
): {
  delays: ResponseDelay[];
  avgDelay: number;
  interruptions: number;
} {
  const delays: ResponseDelay[] = [];
  let totalDelay = 0;
  let interruptionCount = 0;

  for (let i = 1; i < transcript.segments.length; i++) {
    const prevSegment = transcript.segments[i - 1];
    const currSegment = transcript.segments[i];

    // Only track when user is speaking
    if (
      currSegment.speaker === userSpeaker &&
      prevSegment.speaker !== userSpeaker
    ) {
      const delay = currSegment.start - prevSegment.end;

      // Categorize the delay
      let context: string | undefined;
      if (delay < 0) {
        context = 'Interruption';
        interruptionCount++;
      } else if (delay < 0.5) {
        context = 'Quick response';
      } else if (delay < 2) {
        context = 'Natural pause';
      } else {
        context = 'Long pause';
      }

      delays.push({
        afterSpeaker: prevSegment.speaker,
        delaySeconds: Math.round(delay * 100) / 100,
        context,
      });

      totalDelay += delay;
    }
  }

  const avgDelay = delays.length > 0 ? totalDelay / delays.length : 0;

  return {
    delays,
    avgDelay: Math.round(avgDelay * 100) / 100,
    interruptions: interruptionCount,
  };
}

/**
 * Analyze turn-taking patterns
 */
export function analyzeTurnTaking(transcript: Transcript): {
  avgTurnDuration: number;
  longestTurn: { speaker: string; duration: number };
  shortestTurn: { speaker: string; duration: number };
  turnCount: number;
} {
  if (transcript.segments.length === 0) {
    return {
      avgTurnDuration: 0,
      longestTurn: { speaker: 'Unknown', duration: 0 },
      shortestTurn: { speaker: 'Unknown', duration: 0 },
      turnCount: 0,
    };
  }

  const durations = transcript.segments.map((s) => ({
    speaker: s.speaker,
    duration: s.end - s.start,
  }));

  const totalDuration = durations.reduce((sum, d) => sum + d.duration, 0);
  const avgTurnDuration = totalDuration / durations.length;

  const longest = durations.reduce((max, d) =>
    d.duration > max.duration ? d : max
  );

  const shortest = durations.reduce((min, d) =>
    d.duration < min.duration ? d : min
  );

  return {
    avgTurnDuration: Math.round(avgTurnDuration * 10) / 10,
    longestTurn: {
      speaker: longest.speaker,
      duration: Math.round(longest.duration * 10) / 10,
    },
    shortestTurn: {
      speaker: shortest.speaker,
      duration: Math.round(shortest.duration * 10) / 10,
    },
    turnCount: durations.length,
  };
}

/**
 * Calculate words per minute for each speaker
 */
export function calculateWordsPerMinute(
  transcript: Transcript
): Map<string, number> {
  const wpmMap = new Map<string, number>();

  for (const speaker of transcript.speakers) {
    const speakerSegments = transcript.segments.filter(
      (s) => s.speaker === speaker
    );
    const totalWords = speakerSegments.reduce(
      (sum, s) => sum + s.text.split(/\s+/).length,
      0
    );
    const totalMinutes = speakerSegments.reduce(
      (sum, s) => sum + (s.end - s.start) / 60,
      0
    );

    const wpm = totalMinutes > 0 ? Math.round(totalWords / totalMinutes) : 0;
    wpmMap.set(speaker, wpm);
  }

  return wpmMap;
}

/**
 * Detect overlapping speech (multiple speakers at once)
 */
export function detectOverlaps(transcript: Transcript): number {
  let overlapCount = 0;

  for (let i = 1; i < transcript.segments.length; i++) {
    const prevSegment = transcript.segments[i - 1];
    const currSegment = transcript.segments[i];

    // Check if current segment starts before previous one ends
    if (currSegment.start < prevSegment.end) {
      overlapCount++;
    }
  }

  return overlapCount;
}

/**
 * Get speaking order (who spoke first, second, etc.)
 */
export function getSpeakingOrder(transcript: Transcript): string[] {
  const seenSpeakers = new Set<string>();
  const order: string[] = [];

  for (const segment of transcript.segments) {
    if (!seenSpeakers.has(segment.speaker)) {
      order.push(segment.speaker);
      seenSpeakers.add(segment.speaker);
    }
  }

  return order;
}
