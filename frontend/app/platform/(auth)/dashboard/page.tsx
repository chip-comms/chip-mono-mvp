'use client';

import FileUploadZone from '@/components/FileUploadZone';
import RecordingsList from '@/components/RecordingsList';
import AnalysisPanel from '@/components/AnalysisPanel';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface DashboardStats {
  totalMeetings: number;
  hoursAnalyzed: number;
  thisMonth: number;
}

export default function DashboardPage() {
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedAnalysisJob, setSelectedAnalysisJob] = useState<{
    jobId: string;
    filename: string;
  } | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalMeetings: 0,
    hoursAnalyzed: 0,
    thisMonth: 0,
  });

  const fetchStats = async () => {
    try {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all completed meetings with their analysis data
      const { data: completedJobs, error } = await supabase
        .from('processing_jobs')
        .select(
          `
          id,
          created_at,
          meeting_analysis!inner(transcript)
        `
        )
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (error) {
        console.error('Error fetching stats:', error);
        return;
      }

      if (!completedJobs || completedJobs.length === 0) {
        setStats({
          totalMeetings: 0,
          hoursAnalyzed: 0,
          thisMonth: 0,
        });
        return;
      }

      // Calculate total meetings
      const totalMeetings = completedJobs.length;

      // Calculate total hours analyzed (sum of all meeting durations)
      let totalSeconds = 0;
      completedJobs.forEach((job) => {
        const analysis = job.meeting_analysis as any;
        if (analysis && analysis.transcript && analysis.transcript.duration) {
          totalSeconds += analysis.transcript.duration;
        }
      });
      const hoursAnalyzed = Math.round((totalSeconds / 3600) * 10) / 10; // Round to 1 decimal

      // Calculate meetings this month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonth = completedJobs.filter((job) => {
        const createdAt = new Date(job.created_at);
        return createdAt >= firstDayOfMonth;
      }).length;

      setStats({
        totalMeetings,
        hoursAnalyzed,
        thisMonth,
      });
    } catch (err) {
      console.error('Error calculating stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]); // Re-fetch when recordings are refreshed

  const handleUploadComplete = (response: {
    jobId?: string;
    message?: string;
  }) => {
    console.log('Upload complete:', response);
    setUploadSuccess(true);
    // Trigger recordings list refresh and stats refresh
    setRefreshTrigger((prev) => prev + 1);
    // Reset success message after 5 seconds
    setTimeout(() => setUploadSuccess(false), 5000);
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Success Message */}
      {uploadSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            Meeting uploaded successfully! Processing will begin shortly.
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Total Meetings</p>
          <p className="text-3xl font-bold text-gray-900">
            {stats.totalMeetings}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Hours Analyzed</p>
          <p className="text-3xl font-bold text-gray-900">
            {stats.hoursAnalyzed}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600 mb-1">This Month</p>
          <p className="text-3xl font-bold text-gray-900">{stats.thisMonth}</p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Upload a Meeting
        </h2>
        <FileUploadZone
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
        />
      </div>

      {/* Recordings List */}
      <RecordingsList
        onViewAnalysis={setSelectedAnalysisJob}
        refreshTrigger={refreshTrigger}
      />

      {/* Analysis Panel */}
      {selectedAnalysisJob && (
        <AnalysisPanel
          isOpen={true}
          onClose={() => setSelectedAnalysisJob(null)}
          jobId={selectedAnalysisJob.jobId}
          filename={selectedAnalysisJob.filename}
        />
      )}
    </div>
  );
}
