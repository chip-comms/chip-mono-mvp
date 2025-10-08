/**
 * Client for Python backend video processing service
 */

const PYTHON_BACKEND_URL =
  process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export class PythonBackendClient {
  /**
   * Check if Python backend is available
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/api/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.warn('Python backend not available:', error);
      return false;
    }
  }

  /**
   * Extract audio from video file
   */
  static async extractAudio(
    videoFile: File | Blob,
    format: 'wav' | 'mp3' = 'wav'
  ): Promise<Blob> {
    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('format', format);

    const response = await fetch(
      `${PYTHON_BACKEND_URL}/api/video/extract-audio`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to extract audio');
    }

    return await response.blob();
  }

  /**
   * Generate thumbnail from video
   */
  static async generateThumbnail(
    videoFile: File | Blob,
    options: {
      timestamp?: number;
      width?: number;
      height?: number;
    } = {}
  ): Promise<Blob> {
    const formData = new FormData();
    formData.append('file', videoFile);
    if (options.timestamp !== undefined)
      formData.append('timestamp', options.timestamp.toString());
    if (options.width) formData.append('width', options.width.toString());
    if (options.height) formData.append('height', options.height.toString());

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/video/thumbnail`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to generate thumbnail');
    }

    return await response.blob();
  }

  /**
   * Get video metadata
   */
  static async getVideoInfo(videoFile: File | Blob): Promise<{
    duration: number;
    size: number;
    bitrate: number;
    video: {
      codec: string;
      width: number;
      height: number;
      fps: number;
    };
    audio?: {
      codec: string;
      sample_rate: string;
      channels: number;
    };
  }> {
    const formData = new FormData();
    formData.append('file', videoFile);

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/video/info`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get video info');
    }

    return await response.json();
  }

  /**
   * Compress video file
   */
  static async compressVideo(
    videoFile: File | Blob,
    quality: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<Blob> {
    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('quality', quality);

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/video/compress`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to compress video');
    }

    return await response.blob();
  }

  /**
   * Transcribe audio using WhisperX
   */
  static async transcribeAudio(
    audioFile: File | Blob,
    options: {
      language?: string;
      enableWordTimestamps?: boolean;
    } = {}
  ): Promise<{
    text: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
      words?: Array<{ word: string; start: number; end: number }>;
    }>;
    language: string;
    duration: number;
  }> {
    const formData = new FormData();
    formData.append('file', audioFile);
    if (options.language)
      formData.append('language', options.language);
    if (options.enableWordTimestamps !== undefined)
      formData.append('enable_word_timestamps', options.enableWordTimestamps.toString());

    const response = await fetch(
      `${PYTHON_BACKEND_URL}/api/audio/transcribe`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to transcribe audio');
    }

    const result = await response.json();
    return {
      text: result.text,
      segments: result.segments,
      language: result.language,
      duration: result.duration,
    };
  }

  /**
   * Get supported languages for transcription
   */
  static async getSupportedLanguages(): Promise<string[]> {
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/audio/languages`);

    if (!response.ok) {
      throw new Error('Failed to get supported languages');
    }

    const result = await response.json();
    return result.languages;
  }
}

export default PythonBackendClient;
