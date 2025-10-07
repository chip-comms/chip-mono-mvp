// Recording status types
export type RecordingStatus =
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed';

// Recording metadata interface
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
  processingProgress?: number;
}

// Intelligence data interfaces
export interface ActionItem {
  text: string;
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
}

export interface KeyTopic {
  topic: string;
  relevance: number;
}

export interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative';
  score: number;
}

export interface SpeakerStats {
  name: string;
  duration: number;
  wordCount: number;
  percentage: number;
}

export interface ResponseDelay {
  afterSpeaker: string;
  delaySeconds: number;
  context?: string;
}

export interface CompanyValue {
  value: string;
  score: number;
  examples: string[];
}

export interface CommunicationMetrics {
  talkTimePercentage: number;
  responseDelays: ResponseDelay[];
  interruptions?: number;
  companyValuesAlignment: {
    overallAlignment: number;
    values: CompanyValue[];
    insights?: string;
  };
}

export interface Intelligence {
  recordingId: string;
  transcript: string;
  summary: string;
  actionItems: ActionItem[];
  keyTopics: KeyTopic[];
  sentiment: SentimentAnalysis;
  speakerStats: SpeakerStats[];
  communicationMetrics: CommunicationMetrics;
  insights?: string;
}

// API response types
export interface UploadResponse {
  success: boolean;
  recordingId?: string;
  message?: string;
  error?: string;
}

export interface ProcessingResponse {
  success: boolean;
  status: RecordingStatus;
  progress?: number;
  message?: string;
  error?: string;
}

// Upload configuration
export interface UploadConfig {
  maxFileSize: number; // in bytes
  allowedFormats: string[];
  backendUrl: string;
}
