/**
 * Core type definitions
 * These types are used across the entire application
 * They are platform-agnostic and will work in both Node.js and Deno
 */

// ============================================================================
// Recording Types
// ============================================================================

export type RecordingStatus =
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed';

export interface Recording {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  status: RecordingStatus;
  processingError?: string;
  createdAt: string;
}

// ============================================================================
// Transcript Types
// ============================================================================

export interface TranscriptSegment {
  start: number; // Start time in seconds
  end: number; // End time in seconds
  text: string; // What was said
  speaker: string; // Speaker identifier (e.g., "Speaker 1")
}

export interface Transcript {
  segments: TranscriptSegment[];
  fullText: string;
  durationSeconds: number;
  speakers: string[]; // List of unique speakers
}

// ============================================================================
// Intelligence Types
// ============================================================================

export interface ActionItem {
  text: string;
  priority: 'high' | 'medium' | 'low';
}

export interface KeyTopic {
  topic: string;
  relevance: number; // 0-1 score
}

export interface Sentiment {
  overall: 'positive' | 'neutral' | 'negative';
  score: number; // -1 to 1
}

export interface SpeakerStats {
  speaker: string;
  durationSeconds: number;
  wordCount: number;
  percentage: number; // Percentage of total talk time
}

export interface CompanyValue {
  value: string;
  score: number; // 0-1
  examples: string[]; // Quotes from the transcript
}

export interface ResponseDelay {
  afterSpeaker: string;
  delaySeconds: number; // Positive = pause, Negative = interruption
  context?: string; // Optional context from AI
}

export interface CommunicationMetrics {
  talkTimePercentage: number; // User's talk time as %
  speakerBreakdown: SpeakerStats[]; // Breakdown per speaker
  averageResponseDelay: number; // Average in seconds
  responseDelays: ResponseDelay[]; // Individual delays
  interruptions: number; // Count of interruptions
  companyValuesAlignment: {
    overallAlignment: number; // 0-1
    values: CompanyValue[]; // Per-value scores
  };
  insights: string; // AI-generated insights
}

export interface Intelligence {
  recordingId: string;
  transcript: Transcript;
  summary: string;
  actionItems: ActionItem[];
  keyTopics: KeyTopic[];
  sentiment: Sentiment;
  speakerStats: SpeakerStats[];
  communicationMetrics: CommunicationMetrics;
  createdAt: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface UploadResponse {
  success: boolean;
  recordingId?: string;
  error?: string;
}

export interface ProcessResponse {
  success: boolean;
  recordingId?: string;
  intelligenceId?: string;
  processingTimeSeconds?: number;
  error?: string;
}

export interface RecordingsResponse {
  recordings: Recording[];
}

export interface IntelligenceResponse {
  intelligence: Intelligence | null;
  error?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface Config {
  openaiApiKey: string;
  maxFileSizeMB: number;
  supportedFormats: string[];
  companyValues: string[]; // Company values to analyze
}

// ============================================================================
// Storage Adapter Interface
// ============================================================================

export interface StorageAdapter {
  saveFile(
    id: string,
    buffer: Uint8Array,
    contentType: string
  ): Promise<string>;
  getFile(path: string): Promise<Uint8Array>;
  getFileAsArrayBuffer(path: string): Promise<ArrayBuffer>;
  deleteFile(path: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
}

// ============================================================================
// Data Adapter Interface
// ============================================================================

export interface DataAdapter {
  // Recordings
  getRecordings(): Promise<Recording[]>;
  getRecording(id: string): Promise<Recording | null>;
  saveRecording(recording: Recording): Promise<void>;
  updateRecording(id: string, updates: Partial<Recording>): Promise<void>;
  deleteRecording(id: string): Promise<void>;

  // Intelligence
  getIntelligence(recordingId: string): Promise<Intelligence | null>;
  saveIntelligence(intelligence: Intelligence): Promise<void>;
  deleteIntelligence(recordingId: string): Promise<void>;
}
