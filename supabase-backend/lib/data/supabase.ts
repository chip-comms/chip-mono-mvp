import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../database.types';
import {
  MultiTenantDataAdapter,
  Organization,
  User,
  ProcessingJob,
  MeetingAnalysis,
} from '../types';

export class SupabaseDataAdapter implements MultiTenantDataAdapter {
  private supabase: SupabaseClient<Database>;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    options?: { auth?: { persistSession: boolean } }
  ) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey, options);
  }

  // ============================================================================
  // Organizations
  // ============================================================================

  async getOrganization(id: string): Promise<Organization | null> {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching organization:', error);
      return null;
    }

    return data;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('Error fetching organization by slug:', error);
      return null;
    }

    return data;
  }

  async saveOrganization(organization: Organization): Promise<void> {
    const { error } = await this.supabase
      .from('organizations')
      .insert(organization);

    if (error) {
      console.error('Error saving organization:', error);
      throw error;
    }
  }

  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('organizations')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating organization:', error);
      throw error;
    }
  }

  // ============================================================================
  // Users
  // ============================================================================

  async getUser(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    return data;
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users by organization:', error);
      return [];
    }

    return data;
  }

  async saveUser(user: User): Promise<void> {
    const { error } = await this.supabase.from('users').insert(user);

    if (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // ============================================================================
  // Processing Jobs
  // ============================================================================

  async getProcessingJobs(
    organizationId: string,
    userId?: string
  ): Promise<ProcessingJob[]> {
    let query = this.supabase
      .from('processing_jobs')
      .select('*')
      .eq('organization_id', organizationId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      console.error('Error fetching processing jobs:', error);
      return [];
    }

    return data.map(this.mapProcessingJobFromDatabase);
  }

  async getProcessingJob(id: string): Promise<ProcessingJob | null> {
    const { data, error } = await this.supabase
      .from('processing_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching processing job:', error);
      return null;
    }

    return this.mapProcessingJobFromDatabase(data);
  }

  async saveProcessingJob(job: ProcessingJob): Promise<void> {
    const dbJob = this.mapProcessingJobToDatabase(job);
    const { error } = await this.supabase.from('processing_jobs').insert(dbJob);

    if (error) {
      console.error('Error saving processing job:', error);
      throw error;
    }
  }

  async updateProcessingJob(
    id: string,
    updates: Partial<ProcessingJob>
  ): Promise<void> {
    const dbUpdates = this.mapProcessingJobToDatabase(updates as ProcessingJob);
    const { error } = await this.supabase
      .from('processing_jobs')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Error updating processing job:', error);
      throw error;
    }
  }

  async deleteProcessingJob(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('processing_jobs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting processing job:', error);
      throw error;
    }
  }

  // ============================================================================
  // Meeting Analysis
  // ============================================================================

  async getMeetingAnalysis(jobId: string): Promise<MeetingAnalysis | null> {
    const { data, error } = await this.supabase
      .from('meeting_analysis')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (error) {
      console.error('Error fetching meeting analysis:', error);
      return null;
    }

    return data;
  }

  async getMeetingAnalysesByUser(
    userId: string,
    organizationId: string
  ): Promise<MeetingAnalysis[]> {
    const { data, error } = await this.supabase
      .from('meeting_analysis')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching meeting analyses by user:', error);
      return [];
    }

    return data;
  }

  async getMeetingAnalysesByOrganization(
    organizationId: string
  ): Promise<MeetingAnalysis[]> {
    const { data, error } = await this.supabase
      .from('meeting_analysis')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching meeting analyses by organization:', error);
      return [];
    }

    return data;
  }

  async saveMeetingAnalysis(analysis: MeetingAnalysis): Promise<void> {
    const { error } = await this.supabase
      .from('meeting_analysis')
      .insert(analysis);

    if (error) {
      console.error('Error saving meeting analysis:', error);
      throw error;
    }
  }

  async deleteMeetingAnalysis(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('meeting_analysis')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting meeting analysis:', error);
      throw error;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapProcessingJobFromDatabase(
    dbJob: Database['public']['Tables']['processing_jobs']['Row']
  ): ProcessingJob {
    return {
      id: dbJob.id,
      storage_path: dbJob.storage_path,
      original_filename: dbJob.original_filename,
      status: dbJob.status,
      processing_error: dbJob.processing_error,
      python_job_id: dbJob.python_job_id,
      user_id: dbJob.user_id,
      organization_id: dbJob.organization_id,
      file_size_mb: dbJob.file_size_mb,
      duration_seconds: dbJob.duration_seconds,
      delete_after: dbJob.delete_after,
      created_at: dbJob.created_at,
      updated_at: dbJob.updated_at,
    };
  }

  private mapProcessingJobToDatabase(
    job: ProcessingJob
  ): Database['public']['Tables']['processing_jobs']['Insert'] {
    return {
      id: job.id,
      storage_path: job.storage_path,
      original_filename: job.original_filename,
      status: job.status,
      processing_error: job.processing_error,
      python_job_id: job.python_job_id,
      user_id: job.user_id,
      organization_id: job.organization_id,
      file_size_mb: job.file_size_mb,
      duration_seconds: job.duration_seconds,
      delete_after: job.delete_after,
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  }
}
