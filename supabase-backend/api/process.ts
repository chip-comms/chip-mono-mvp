/**
 * Process Recording API Route
 *
 * Processes uploaded recordings through the AI pipeline.
 * This will be moved to frontend/app/api/process/route.ts when ready.
 */

import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { LocalStorageAdapter } from '../lib/storage/local';
import { LocalDataAdapter } from '../lib/data/local';
import { transcribeAudio } from '../lib/ai/transcription';
import {
  analyzeTranscript,
  generateCommunicationInsights,
} from '../lib/ai/analysis';
import {
  calculateCommunicationMetrics,
  calculateSpeakerStats,
} from '../lib/ai/metrics';
import type { Intelligence } from '../lib/types';
import { config } from '../lib/config';

const storage = new LocalStorageAdapter();
const data = new LocalDataAdapter();

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let recordingId: string | undefined;
  let tempAudioPath: string | undefined;

  try {
    const body = await req.json();
    recordingId = body.recordingId;

    if (!recordingId) {
      return NextResponse.json(
        { success: false, error: 'Recording ID is required' },
        { status: 400 }
      );
    }

    console.log(`[${recordingId}] Starting processing...`);

    // Get recording metadata
    const recording = await data.getRecording(recordingId);
    if (!recording) {
      return NextResponse.json(
        { success: false, error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Update status to processing
    await data.updateRecording(recordingId, { status: 'processing' });

    // Get file from storage
    console.log(`[${recordingId}] Fetching file from storage...`);
    const fileBuffer = await storage.getFile(recording.filename);

    // Extract audio if video file
    let audioFile: File;
    if (recording.fileType.startsWith('video/')) {
      console.log(`[${recordingId}] Extracting audio from video...`);
      tempAudioPath = await extractAudio(fileBuffer, recording.fileType);
      const audioBuffer = await fs.readFile(tempAudioPath);
      audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });
    } else {
      // Already audio file
      audioFile = new File([fileBuffer], recording.filename, {
        type: recording.fileType,
      });
    }

    // Step 1: Transcribe audio
    console.log(`[${recordingId}] Transcribing audio...`);
    const transcript = await transcribeAudio(audioFile, config.openaiApiKey);
    console.log(
      `[${recordingId}] Transcription complete. Duration: ${transcript.durationSeconds}s, Speakers: ${transcript.speakers.length}`
    );

    // Update recording duration
    await data.updateRecording(recordingId, {
      durationSeconds: transcript.durationSeconds,
    });

    // Step 2: Analyze transcript
    console.log(`[${recordingId}] Analyzing transcript...`);
    const analysis = await analyzeTranscript(
      transcript,
      config.openaiApiKey,
      config.companyValues
    );
    console.log(
      `[${recordingId}] Analysis complete. Action items: ${analysis.actionItems.length}, Topics: ${analysis.keyTopics.length}`
    );

    // Step 3: Calculate communication metrics
    console.log(`[${recordingId}] Calculating communication metrics...`);
    const baseMetrics = calculateCommunicationMetrics(transcript);
    const speakerStats = calculateSpeakerStats(transcript);

    // Generate AI insights about communication patterns
    const insights = await generateCommunicationInsights(
      transcript,
      baseMetrics.talkTimePercentage,
      baseMetrics.interruptions,
      config.openaiApiKey
    );

    // Combine metrics with company values from analysis
    const communicationMetrics = {
      ...baseMetrics,
      companyValuesAlignment: analysis.companyValuesAlignment || {
        overallAlignment: 0,
        values: [],
      },
      insights,
    };

    // Step 4: Save intelligence
    console.log(`[${recordingId}] Saving intelligence...`);
    const intelligence: Intelligence = {
      recordingId,
      transcript,
      summary: analysis.summary,
      actionItems: analysis.actionItems,
      keyTopics: analysis.keyTopics,
      sentiment: analysis.sentiment,
      speakerStats,
      communicationMetrics,
      createdAt: new Date().toISOString(),
    };

    await data.saveIntelligence(intelligence);

    // Update recording status to completed
    await data.updateRecording(recordingId, { status: 'completed' });

    const processingTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`[${recordingId}] Processing complete in ${processingTime}s`);

    return NextResponse.json({
      success: true,
      recordingId,
      intelligenceId: intelligence.recordingId,
      processingTimeSeconds: processingTime,
    });
  } catch (error) {
    console.error('Processing error:', error);

    // Update recording status to failed
    if (recordingId) {
      await data.updateRecording(recordingId, {
        status: 'failed',
        processingError:
          error instanceof Error ? error.message : 'Processing failed',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
        recordingId,
      },
      { status: 500 }
    );
  } finally {
    // Clean up temp audio file
    if (tempAudioPath) {
      try {
        await fs.unlink(tempAudioPath);
      } catch (error) {
        console.error('Failed to clean up temp file:', error);
      }
    }
  }
}

/**
 * Extract audio from video file using FFmpeg
 */
async function extractAudio(
  videoBuffer: Uint8Array,
  contentType: string
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    // Create temp files
    const tempDir = os.tmpdir();
    const videoExt = contentType.split('/')[1] || 'mp4';
    const videoPath = path.join(tempDir, `video-${Date.now()}.${videoExt}`);
    const audioPath = path.join(tempDir, `audio-${Date.now()}.mp3`);

    try {
      // Write video to temp file
      await fs.writeFile(videoPath, videoBuffer);

      // Extract audio using FFmpeg
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .noVideo()
        .on('end', async () => {
          // Clean up video file
          try {
            await fs.unlink(videoPath);
          } catch (error) {
            console.error('Failed to clean up video file:', error);
          }
          resolve(audioPath);
        })
        .on('error', async (error) => {
          // Clean up on error
          try {
            await fs.unlink(videoPath);
            await fs.unlink(audioPath).catch(() => {});
          } catch (cleanupError) {
            console.error('Failed to clean up files:', cleanupError);
          }
          reject(new Error(`FFmpeg error: ${error.message}`));
        })
        .run();
    } catch (error) {
      reject(error);
    }
  });
}
