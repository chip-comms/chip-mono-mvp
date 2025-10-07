'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileVideo,
  FileAudio,
  Clock,
  Calendar,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Recording, Intelligence } from '@/lib/types';
import { MeetingAssistantAPI } from '@/lib/api-client';
import IntelligenceViewer from './IntelligenceViewer';

interface RecordingsListProps {
  recordings: Recording[];
  onRefresh: () => void;
}

export default function RecordingsList({
  recordings,
  onRefresh,
}: RecordingsListProps) {
  const [expandedRecording, setExpandedRecording] = useState<string | null>(
    null
  );
  const [intelligence, setIntelligence] = useState<{
    [key: string]: Intelligence;
  }>({});
  const [loadingIntelligence, setLoadingIntelligence] = useState<{
    [key: string]: boolean;
  }>({});

  // Auto-refresh for processing recordings
  useEffect(() => {
    const processingRecordings = recordings.filter(
      (r) => r.status === 'processing'
    );

    if (processingRecordings.length > 0) {
      const interval = setInterval(() => {
        onRefresh();
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [recordings, onRefresh]);

  const handleToggleExpand = async (
    recordingId: string,
    recording: Recording
  ) => {
    if (expandedRecording === recordingId) {
      setExpandedRecording(null);
      return;
    }

    setExpandedRecording(recordingId);

    // Load intelligence if completed and not already loaded
    if (
      recording.status === 'completed' &&
      !intelligence[recordingId] &&
      !loadingIntelligence[recordingId]
    ) {
      setLoadingIntelligence((prev) => ({ ...prev, [recordingId]: true }));

      try {
        const intelligenceData =
          await MeetingAssistantAPI.getIntelligence(recordingId);
        if (intelligenceData) {
          setIntelligence((prev) => ({
            ...prev,
            [recordingId]: intelligenceData,
          }));
        }
      } catch (error) {
        console.error('Failed to load intelligence:', error);
      } finally {
        setLoadingIntelligence((prev) => ({ ...prev, [recordingId]: false }));
      }
    }
  };

  const renderStatusBadge = (
    status: Recording['status'],
    progress?: number
  ) => {
    const statusConfig = {
      uploading: {
        icon: Loader2,
        className: 'bg-blue-100 text-blue-700 border-blue-200',
        label: 'Uploading',
        spinning: true,
      },
      processing: {
        icon: Loader2,
        className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        label: `Processing${progress ? ` (${progress}%)` : ''}`,
        spinning: true,
      },
      completed: {
        icon: CheckCircle2,
        className: 'bg-green-100 text-green-700 border-green-200',
        label: 'Completed',
        spinning: false,
      },
      failed: {
        icon: XCircle,
        className: 'bg-red-100 text-red-700 border-red-200',
        label: 'Failed',
        spinning: false,
      },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}
      >
        <Icon
          className={`w-3 h-3 mr-1 ${config.spinning ? 'animate-spin' : ''}`}
        />
        {config.label}
      </span>
    );
  };

  const renderFileIcon = (fileType: string) => {
    if (fileType.startsWith('video/')) {
      return <FileVideo className="w-5 h-5 text-blue-500" />;
    } else if (fileType.startsWith('audio/')) {
      return <FileAudio className="w-5 h-5 text-green-500" />;
    }
    return <FileVideo className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (recordings.length === 0) {
    return (
      <div className="text-center py-12">
        <FileVideo className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No recordings yet
        </h3>
        <p className="text-gray-500">
          Upload your first meeting recording to get started with AI analysis
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Your Recordings</h2>
        <div className="text-sm text-gray-500">
          {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-3">
        {recordings
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .map((recording) => (
            <div
              key={recording.id}
              className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
            >
              {/* Recording Header */}
              <div
                onClick={() => handleToggleExpand(recording.id, recording)}
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    {renderFileIcon(recording.fileType)}

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {recording.title}
                      </h3>
                      <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(recording.createdAt)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <FileVideo className="w-3 h-3" />
                          <span>{formatFileSize(recording.fileSizeBytes)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {renderStatusBadge(
                      recording.status,
                      recording.processingProgress
                    )}

                    {expandedRecording === recording.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedRecording === recording.id && (
                <div className="border-t border-gray-200">
                  {recording.status === 'completed' ? (
                    <div className="p-4">
                      {loadingIntelligence[recording.id] ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mr-3" />
                          <span className="text-gray-600">
                            Loading intelligence data...
                          </span>
                        </div>
                      ) : intelligence[recording.id] ? (
                        <div className="space-y-4">
                          {/* Video/Audio Player */}
                          <div className="bg-black rounded-lg overflow-hidden">
                            {recording.fileType.startsWith('video/') ? (
                              <video
                                controls
                                className="w-full max-h-96"
                                preload="metadata"
                              >
                                <source
                                  src={MeetingAssistantAPI.getRecordingUrl(
                                    recording.id,
                                    recording.filename
                                  )}
                                  type={recording.fileType}
                                />
                                Your browser does not support the video tag.
                              </video>
                            ) : (
                              <audio
                                controls
                                className="w-full"
                                preload="metadata"
                              >
                                <source
                                  src={MeetingAssistantAPI.getRecordingUrl(
                                    recording.id,
                                    recording.filename
                                  )}
                                  type={recording.fileType}
                                />
                                Your browser does not support the audio tag.
                              </audio>
                            )}
                          </div>

                          {/* Intelligence Display */}
                          <IntelligenceViewer
                            intelligence={intelligence[recording.id]}
                            recordingTitle={recording.title}
                          />
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                          <p className="text-gray-600">
                            Failed to load intelligence data
                          </p>
                          <button
                            onClick={() =>
                              handleToggleExpand(recording.id, recording)
                            }
                            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                          >
                            Try again
                          </button>
                        </div>
                      )}
                    </div>
                  ) : recording.status === 'processing' ? (
                    <div className="p-8 text-center">
                      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        Processing Recording
                      </h4>
                      <p className="text-gray-600 mb-4">
                        Our AI is analyzing your meeting recording. This
                        typically takes 2-5 minutes.
                      </p>
                      {recording.processingProgress && (
                        <div className="max-w-xs mx-auto">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${recording.processingProgress}%`,
                              }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-500 mt-2">
                            {recording.processingProgress}% complete
                          </p>
                        </div>
                      )}
                    </div>
                  ) : recording.status === 'failed' ? (
                    <div className="p-8 text-center">
                      <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        Processing Failed
                      </h4>
                      <p className="text-gray-600">
                        We encountered an error while processing your recording.
                        Please try uploading again.
                      </p>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        Upload in Progress
                      </h4>
                      <p className="text-gray-600">
                        Your file is being uploaded and will begin processing
                        shortly.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
