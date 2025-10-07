import axios, { AxiosProgressEvent } from 'axios';
import { Recording, Intelligence, UploadResponse, ProcessingResponse } from './types';

// Configuration - using local Next.js API routes
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes for file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

export class MeetingAssistantAPI {
  
  /**
   * Upload a file to the backend for processing
   */
  static async uploadFile(
    file: File,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
      });

      return {
        success: true,
        recordingId: response.data.recordingId || response.data.id,
        message: response.data.message || 'Upload successful',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      console.error('Upload failed:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Process a sample recording (for demo purposes)
   */
  static async processSampleRecording(sampleFilename: string): Promise<UploadResponse> {
    try {
      const response = await apiClient.post('/api/process-sample', {
        filename: sampleFilename,
      });

      return {
        success: true,
        recordingId: response.data.recordingId || response.data.id,
        message: response.data.message || 'Sample processing started',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Sample processing failed';
      console.error('Sample processing failed:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get list of all recordings
   */
  static async getRecordings(): Promise<Recording[]> {
    try {
      const response = await apiClient.get('/api/recordings');
      return response.data.recordings || response.data || [];
    } catch (error: unknown) {
      console.error('Failed to fetch recordings:', error);
      return [];
    }
  }

  /**
   * Get processing status for a specific recording
   */
  static async getProcessingStatus(recordingId: string): Promise<ProcessingResponse> {
    try {
      const response = await apiClient.get(`/api/recordings/${recordingId}/status`);
      return {
        success: true,
        status: response.data.status,
        progress: response.data.progress,
        message: response.data.message,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Status check failed';
      console.error('Failed to fetch processing status:', error);
      return {
        success: false,
        status: 'failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Get intelligence data for a completed recording
   */
  static async getIntelligence(recordingId: string): Promise<Intelligence | null> {
    try {
      const response = await apiClient.get(`/api/intelligence/${recordingId}`);
      return response.data;
    } catch (error: unknown) {
      console.error('Failed to fetch intelligence:', error);
      return null;
    }
  }

  /**
   * Get recording file URL (for video/audio playback)
   */
  static getRecordingUrl(recordingId: string, filename: string): string {
    return `${API_BASE_URL}/api/recordings/${recordingId}/file/${filename}`;
  }

  /**
   * Delete a recording (if backend supports it)
   */
  static async deleteRecording(recordingId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/api/recordings/${recordingId}`);
      return true;
    } catch (error: unknown) {
      console.error('Failed to delete recording:', error);
      return false;
    }
  }

  /**
   * Health check for backend connectivity
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await apiClient.get('/api/health');
      return response.status === 200;
    } catch (error) {
      console.warn('Backend health check failed:', error);
      return false;
    }
  }
}

export default MeetingAssistantAPI;