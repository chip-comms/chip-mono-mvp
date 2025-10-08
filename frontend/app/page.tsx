'use client';

import React, { useState, useEffect } from 'react';
import { MeetingAssistantAPI } from '@/lib/api-client';
import type { Recording } from '@/lib/types';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Play,
  Loader2,
  RefreshCw,
} from 'lucide-react';

type ProcessingStep = {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  message?: string;
};

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRecording, setCurrentRecording] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intelligence, setIntelligence] = useState<any>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { id: 'upload', name: 'Copying Sample File', status: 'pending' },
    { id: 'extract', name: 'Extracting Audio', status: 'pending' },
    { id: 'transcribe', name: 'Transcribing Audio', status: 'pending' },
    { id: 'analyze', name: 'AI Analysis', status: 'pending' },
    { id: 'complete', name: 'Complete', status: 'pending' }
  ]);

  // Auto-refresh processing status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing && currentRecording) {
      interval = setInterval(async () => {
        await checkRecordingStatus();
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, currentRecording]);

  const checkRecordingStatus = async () => {
    if (!currentRecording) {
      setIsProcessing(false);
      return;
    }

    try {
      const recordings = await MeetingAssistantAPI.getRecordings();
      const updated = recordings.find((r) => r.id === currentRecording.id);

      if (updated) {
        setCurrentRecording(updated);
        updateProcessingSteps(updated.status);

        if (updated.status === 'completed' || updated.status === 'failed') {
          setIsProcessing(false);
          
          // Load intelligence data if completed
          if (updated.status === 'completed') {
            loadIntelligence(updated.id);
          }
        }
      } else {
        // Recording not found, stop polling
        setIsProcessing(false);
        setCurrentRecording(null);
      }
    } catch (error) {
      console.error('Failed to check status:', error);
      // On error, stop polling after a few attempts
      setIsProcessing(false);
    }
  };

  const loadIntelligence = async (recordingId: string) => {
    try {
      const response = await fetch(`/api/intelligence/${recordingId}`);
      const data = await response.json();
      
      if (response.ok && data && !data.error) {
        setIntelligence(data);
        console.log('Intelligence loaded:', data);
      }
    } catch (error) {
      console.error('Failed to load intelligence:', error);
    }
  };

  const updateProcessingSteps = (status: string) => {
    setProcessingSteps((prev) => {
      const newSteps = [...prev];

      switch (status) {
        case 'processing':
          newSteps[0].status = 'completed'; // upload
          newSteps[1].status = 'completed'; // extract
          newSteps[2].status = 'active'; // transcribe
          newSteps[2].message = 'Using local Whisper...';
          break;
        case 'completed':
          newSteps.forEach((step) => (step.status = 'completed'));
          break;
        case 'failed':
          const activeIndex = newSteps.findIndex((s) => s.status === 'active');
          if (activeIndex >= 0) {
            newSteps[activeIndex].status = 'failed';
          }
          break;
      }

      return newSteps;
    });
  };

  const startSampleProcessing = async () => {
    setIsProcessing(true);
    setError(null);
    setCurrentRecording(null);

    // Reset steps
    setProcessingSteps((prev) =>
      prev.map((step) => ({
        ...step,
        status: 'pending' as const,
        message: undefined,
      }))
    );

    // Start first step
    setProcessingSteps((prev) => {
      const newSteps = [...prev];
      newSteps[0].status = 'active';
      newSteps[0].message = 'Copying sample video file...';
      return newSteps;
    });

    try {
      const sampleFilename = 'Beau_Lauren (2024-06-20 15_06 GMT-4).mp4';
      const result =
        await MeetingAssistantAPI.processSampleRecording(sampleFilename);

      if (result.success && result.recordingId) {
        // Get the recording details
        const recordings = await MeetingAssistantAPI.getRecordings();
        const recording = recordings.find((r) => r.id === result.recordingId);
        if (recording) {
          setCurrentRecording(recording);
          updateProcessingSteps(recording.status);
        }
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Processing failed';
      setError(errorMessage);
      setIsProcessing(false);

      // Mark current active step as failed
      setProcessingSteps((prev) => {
        const newSteps = [...prev];
        const activeIndex = newSteps.findIndex((s) => s.status === 'active');
        if (activeIndex >= 0) {
          newSteps[activeIndex].status = 'failed';
          newSteps[activeIndex].message = errorMessage;
        }
        return newSteps;
      });
    }
  };

  const resetDemo = () => {
    setIsProcessing(false);
    setCurrentRecording(null);
    setError(null);
    setIntelligence(null);
    setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending' as const, message: undefined })));
  };

  const getStepIcon = (step: ProcessingStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'active':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStepTextColor = (step: ProcessingStep) => {
    switch (step.status) {
      case 'completed':
        return 'text-green-600';
      case 'active':
        return 'text-blue-600 font-medium';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎤 Meeting Intelligence Demo
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Test the AI processing pipeline with a sample recording
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Main Demo Panel */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            {/* Demo Info */}
            <div className="text-center mb-8">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-center mb-4">
                  <Play className="w-8 h-8 text-purple-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    Sample Recording Ready
                  </h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Beau & Lauren Meeting (2024-06-20) • ~26 minutes
                </p>
                <p className="text-xs text-gray-500">
                  This will test: File processing → Audio extraction → Local
                  Whisper transcription → AI analysis
                </p>
              </div>

              {!isProcessing && !currentRecording && (
                <button
                  onClick={startSampleProcessing}
                  className="px-8 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <Play className="w-5 h-5" />
                  <span>Start Processing Demo</span>
                </button>
              )}

              {(isProcessing || currentRecording) && (
                <button
                  onClick={resetDemo}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reset Demo</span>
                </button>
              )}
            </div>

            {/* Processing Steps */}
            {(isProcessing || currentRecording) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                  Processing Pipeline
                </h3>

                {processingSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex items-center space-x-4 p-4 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm">
                      <span className="text-sm font-medium text-gray-600">
                        {index + 1}
                      </span>
                    </div>

                    {getStepIcon(step)}

                    <div className="flex-1">
                      <div className={`font-medium ${getStepTextColor(step)}`}>
                        {step.name}
                      </div>
                      {step.message && (
                        <div className="text-sm text-gray-600 mt-1">
                          {step.message}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Recording Info */}
                {currentRecording && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-2">
                      Recording Details
                    </h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      <div>ID: {currentRecording.id}</div>
                      <div>
                        Status:{' '}
                        <span className="capitalize font-medium">
                          {currentRecording.status}
                        </span>
                      </div>
                      <div>
                        File Size:{' '}
                        {Math.round(
                          currentRecording.fileSizeBytes / 1024 / 1024
                        )}{' '}
                        MB
                      </div>
                      {currentRecording.durationSeconds && (
                        <div>
                          Duration:{' '}
                          {Math.round(currentRecording.durationSeconds / 60)}{' '}
                          minutes
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Success State */}
            {currentRecording?.status === 'completed' && (
              <div className="mt-6 space-y-6">
                <div className="text-center">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-green-800 mb-2">
                      Processing Complete!
                    </h3>
                    <p className="text-green-700">
                      Your recording has been successfully transcribed and analyzed.
                    </p>
                  </div>
                </div>
                
                {/* AI Analysis Results */}
                {intelligence && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      🤖 AI Analysis Results
                    </h3>
                    
                    {/* Summary */}
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-700 mb-2">📋 Summary:</h4>
                      <p className="text-gray-600 bg-gray-50 p-3 rounded">{intelligence.summary}</p>
                    </div>
                    
                    {/* Action Items */}
                    {intelligence.actionItems && intelligence.actionItems.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-medium text-gray-700 mb-2">✅ Action Items:</h4>
                        <ul className="space-y-2">
                          {intelligence.actionItems.map((item: any, index: number) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className={`inline-block w-2 h-2 rounded-full mt-2 ${
                                item.priority === 'high' ? 'bg-red-500' :
                                item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                              }`}></span>
                              <div>
                                <span className="text-gray-800">{item.text}</span>
                                <span className={`ml-2 text-xs px-2 py-1 rounded ${
                                  item.priority === 'high' ? 'bg-red-100 text-red-700' :
                                  item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>{item.priority}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Key Topics */}
                    {intelligence.keyTopics && intelligence.keyTopics.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-medium text-gray-700 mb-2">🏷️ Key Topics:</h4>
                        <div className="flex flex-wrap gap-2">
                          {intelligence.keyTopics.map((topic: any, index: number) => (
                            <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                              {topic.topic} ({Math.round(topic.relevance * 100)}%)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Sentiment */}
                    {intelligence.sentiment && (
                      <div className="mb-6">
                        <h4 className="font-medium text-gray-700 mb-2">😊 Sentiment:</h4>
                        <div className="bg-gray-50 p-3 rounded">
                          <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                            intelligence.sentiment.overall === 'positive' ? 'bg-green-100 text-green-800' :
                            intelligence.sentiment.overall === 'negative' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {intelligence.sentiment.overall}
                          </span>
                          <span className="ml-2 text-gray-600">
                            Score: {intelligence.sentiment.score}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Communication Insights */}
                    {intelligence.communicationMetrics?.insights && (
                      <div className="mb-6">
                        <h4 className="font-medium text-gray-700 mb-2">💬 Communication Insights:</h4>
                        <p className="text-gray-600 bg-blue-50 p-3 rounded">
                          {intelligence.communicationMetrics.insights}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
