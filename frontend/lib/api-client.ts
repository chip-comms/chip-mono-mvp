import { supabase } from './supabase';
import {
  Recording,
  Intelligence,
  UploadResponse,
  ProcessingResponse,
} from './types';

export class MeetingAssistantAPI {
  /**
   * Upload a file to Supabase Storage and create processing job (no auth MVP)
   */
  static async uploadFile(
    file: File,
    onUploadProgress?: (progressEvent: {
      loaded: number;
      total: number;
    }) => void
  ): Promise<UploadResponse> {
    try {
      console.log('🔄 Starting file upload to Supabase...');

      // 1. Upload to Supabase Storage (public bucket for MVP)
      const fileName = `public/${Date.now()}_${file.name}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('meeting-recordings')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ File uploaded to storage:', uploadData.path);

      // 2. Create processing job in database
      const { data: jobData, error: jobError } = await supabase
        .from('processing_jobs')
        .insert({
          storage_path: uploadData.path,
          original_filename: file.name,
          status: 'pending',
          file_size_mb: Number((file.size / (1024 * 1024)).toFixed(2)),
          user_id: 'temp-user-id', // This will be replaced once auth is implemented
          organization_id: 'temp-org-id', // This will be replaced once auth is implemented
        })
        .select()
        .single();

      if (jobError) {
        console.error('❌ Job creation error:', jobError);
        throw jobError;
      }

      console.log('✅ Processing job created:', jobData.id);

      // 3. Trigger processing via Edge Function
      console.log('🚀 Triggering Edge Function...');
      const { data: edgeFunctionResult, error: edgeFunctionError } =
        await supabase.functions.invoke('process-meeting', {
          body: {
            videoUrl: uploadData.path,
            jobId: jobData.id,
          },
        });

      if (edgeFunctionError) {
        console.error('❌ Edge Function error:', edgeFunctionError);
        // Don't throw here - the job is created, we just couldn't start processing
        // The user can retry or the job will be visible as pending
        return {
          success: true,
          recordingId: jobData.id,
          message:
            'Upload successful, but processing failed to start. Please try again.',
        };
      }

      console.log(
        '✅ Edge Function triggered successfully:',
        edgeFunctionResult
      );

      return {
        success: true,
        recordingId: jobData.id,
        message: 'Upload successful and processing job created',
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Upload failed';
      console.error('❌ Upload failed:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Process a sample recording (for demo purposes)
   * For MVP, we'll disable this since it requires existing sample data
   */
  static async processSampleRecording(
    _sampleFilename: string
  ): Promise<UploadResponse> {
    // For MVP, just return a message that this feature is coming soon
    return {
      success: false,
      error: 'Sample processing not yet implemented in Supabase MVP',
    };
  }

  /**
   * Get list of all recordings from Supabase
   */
  static async getRecordings(): Promise<Recording[]> {
    try {
      const { data, error } = await supabase
        .from('processing_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(
        (job: {
          created_at: string | null;
          delete_after: string | null;
          duration_seconds: number | null;
          file_size_mb: number | null;
          id: string;
          organization_id: string;
          original_filename: string | null;
          processing_error: string | null;
          python_job_id: string | null;
          status:
            | 'uploading'
            | 'pending'
            | 'processing'
            | 'completed'
            | 'failed';
          storage_path: string | null;
          updated_at: string | null;
          user_id: string;
        }): Recording => ({
          id: job.id,
          title:
            job.original_filename ||
            job.storage_path?.split('/').pop() ||
            'Unknown Recording',
          filename: job.storage_path || '',
          fileType: 'video/mp4', // Default for now
          fileSizeBytes: job.file_size_mb ? job.file_size_mb * 1024 * 1024 : 0,
          status: job.status as Recording['status'],
          createdAt: job.created_at || new Date().toISOString(),
          processingError: job.processing_error || undefined,
        })
      );
    } catch (error: unknown) {
      console.error('Failed to fetch recordings:', error);
      return [];
    }
  }

  /**
   * Get processing status from Supabase
   */
  static async getProcessingStatus(
    recordingId: string
  ): Promise<ProcessingResponse> {
    try {
      const { data, error } = await supabase
        .from('processing_jobs')
        .select('status, processing_error')
        .eq('id', recordingId)
        .single();

      if (error) throw error;

      return {
        success: true,
        status: data.status as Recording['status'],
        error: data.processing_error || undefined,
      };
    } catch (error: unknown) {
      console.error('Failed to fetch processing status:', error);
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Status check failed',
      };
    }
  }

  /**
   * Get intelligence data for a completed recording from Supabase
   */
  static async getIntelligence(
    recordingId: string
  ): Promise<Intelligence | null> {
    try {
      const { data, error } = await supabase
        .from('meeting_analysis')
        .select('*')
        .eq('job_id', recordingId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No results found
          return null;
        }
        throw error;
      }

      // Transform Supabase data to Intelligence format
      const transcript =
        typeof data.transcript === 'object' &&
        data.transcript &&
        'text' in data.transcript
          ? (data.transcript as any).text
          : '';

      return {
        recordingId: data.job_id,
        transcript: transcript || '',
        summary: data.summary || '',
        actionItems: [], // Not implemented yet
        keyTopics: [], // Not implemented yet
        sentiment: { overall: 'neutral', score: 0 }, // Not implemented yet
        speakerStats: Array.isArray(data.speaker_stats)
          ? (data.speaker_stats as any[])
          : [],
        communicationMetrics:
          typeof data.communication_metrics === 'object' &&
          data.communication_metrics
            ? (data.communication_metrics as any)
            : {},
        insights: data.summary || undefined, // Use summary as insights for now
      };
    } catch (error: unknown) {
      console.error('Failed to fetch intelligence:', error);
      return null;
    }
  }

  /**
   * Get recording file URL from Supabase Storage
   */
  static getRecordingUrl(recordingId: string, filename: string): string {
    // For now, construct URL based on what we know about the storage structure
    // This will need to be updated when we have proper file metadata
    const { data } = supabase.storage
      .from('meeting-recordings')
      .getPublicUrl(filename);

    return data.publicUrl;
  }

  /**
   * Delete a recording from Supabase (both database and storage)
   */
  static async deleteRecording(recordingId: string): Promise<boolean> {
    try {
      // First get the recording to find the storage path
      const { data: job, error: fetchError } = await supabase
        .from('processing_jobs')
        .select('storage_path')
        .eq('id', recordingId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from database (this will cascade to meeting_analysis)
      const { error: deleteError } = await supabase
        .from('processing_jobs')
        .delete()
        .eq('id', recordingId);

      if (deleteError) throw deleteError;

      // Delete from storage
      if (job?.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('meeting-recordings')
          .remove([job.storage_path]);

        if (storageError) {
          console.warn('Storage deletion failed:', storageError);
          // Don't fail the whole operation if storage cleanup fails
        }
      }

      return true;
    } catch (error: unknown) {
      console.error('Failed to delete recording:', error);
      return false;
    }
  }

  /**
   * Health check for Supabase connectivity
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('processing_jobs')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      console.warn('Supabase health check failed:', error);
      return false;
    }
  }

  /**
   * Real-time subscription for job status updates
   */
  static subscribeToJobUpdates(
    jobId: string,
    callback: (status: string) => void
  ) {
    return supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'processing_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload: { new: { status: string } }) => {
          console.log('Job status update:', payload.new.status);
          callback(payload.new.status);
        }
      )
      .subscribe();
  }
}

export default MeetingAssistantAPI;
