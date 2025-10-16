'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

interface AnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  filename: string;
}

interface SpeakerStat {
  total_time: number;
  word_count: number;
  segments: number;
  percentage: number;
  communication_tips: string[];
}

interface MeetingAnalysis {
  transcript: {
    text: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
      speaker: string;
      confidence?: number;
    }>;
    speakers: string[];
    duration: number;
    num_speakers: number;
  };
  summary: string | null;
  speaker_stats: Record<string, SpeakerStat>;
  communication_metrics: {
    response_latency?: {
      average_seconds: number;
      quick_responses_count: number;
      quick_responses_percentage: number;
    };
    interruptions?: {
      total_count: number;
      rate_per_minute: number;
    };
  };
}

export default function AnalysisPanel({
  isOpen,
  onClose,
  jobId,
  filename,
}: AnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'transcript' | 'speakers' | 'metrics'
  >('transcript');

  const fetchAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from('meeting_analysis')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (fetchError) throw fetchError;

      setAnalysis(data as unknown as MeetingAnalysis);
    } catch (err) {
      console.error('Error fetching analysis:', err);
      setError('Failed to load analysis. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (isOpen && jobId) {
      fetchAnalysis();
    }
  }, [isOpen, jobId, fetchAnalysis]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - click to close */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Meeting Analysis
              </h2>
              <p className="text-sm text-gray-600 mt-1">{filename}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4">
            {[
              { id: 'transcript', label: 'Transcript' },
              { id: 'speakers', label: 'Speakers' },
              { id: 'metrics', label: 'Metrics' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(tab.id as 'transcript' | 'speakers' | 'metrics')
                }
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading analysis...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!isLoading && !error && analysis && (
            <>
              {/* Transcript Tab */}
              {activeTab === 'transcript' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Full Transcript
                  </h3>
                  {analysis.transcript.segments.map((segment, idx) => (
                    <div
                      key={idx}
                      className="border-l-4 border-blue-500 pl-4 py-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-blue-600">
                          {segment.speaker}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(segment.start)} -{' '}
                          {formatTime(segment.end)}
                        </span>
                      </div>
                      <p className="text-gray-700">{segment.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Speakers Tab */}
              {activeTab === 'speakers' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Speaker Statistics
                  </h3>
                  {Object.entries(analysis.speaker_stats).map(
                    ([speaker, stats]) => (
                      <div key={speaker} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-md font-semibold text-gray-900 mb-3">
                          {speaker}
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">
                              Talk Time
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {formatDuration(stats.total_time)} (
                              {stats.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${stats.percentage}%` }}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200">
                            <div>
                              <p className="text-xs text-gray-500">Words</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {stats.word_count}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Segments</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {stats.segments}
                              </p>
                            </div>
                          </div>

                          {/* Communication Tips */}
                          {stats.communication_tips &&
                            stats.communication_tips.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                                  <svg
                                    className="w-4 h-4 mr-1 text-blue-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                    />
                                  </svg>
                                  Communication Tips
                                </p>
                                <ul className="space-y-2">
                                  {stats.communication_tips.map((tip, idx) => (
                                    <li
                                      key={idx}
                                      className="text-sm text-gray-700 flex items-start"
                                    >
                                      <span className="text-blue-600 mr-2 mt-0.5">
                                        •
                                      </span>
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Metrics Tab */}
              {activeTab === 'metrics' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Communication Metrics
                  </h3>

                  {/* Response Latency */}
                  {analysis.communication_metrics.response_latency && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-blue-900 mb-3">
                        Response Latency
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-blue-700">
                            Average Gap
                          </span>
                          <span className="text-sm font-medium text-blue-900">
                            {analysis.communication_metrics.response_latency.average_seconds.toFixed(
                              2
                            )}
                            s
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-blue-700">
                            Quick Responses (&lt;1s)
                          </span>
                          <span className="text-sm font-medium text-blue-900">
                            {
                              analysis.communication_metrics.response_latency
                                .quick_responses_count
                            }{' '}
                            (
                            {analysis.communication_metrics.response_latency.quick_responses_percentage.toFixed(
                              1
                            )}
                            %)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Interruptions */}
                  {analysis.communication_metrics.interruptions && (
                    <div className="bg-orange-50 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-orange-900 mb-3">
                        Interruptions
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-orange-700">
                            Total Count
                          </span>
                          <span className="text-sm font-medium text-orange-900">
                            {
                              analysis.communication_metrics.interruptions
                                .total_count
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-orange-700">
                            Rate per Minute
                          </span>
                          <span className="text-sm font-medium text-orange-900">
                            {analysis.communication_metrics.interruptions.rate_per_minute.toFixed(
                              2
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
