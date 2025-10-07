'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Recording } from '@/lib/types';
import { MeetingAssistantAPI } from '@/lib/api-client';
import FileUpload from '@/components/FileUpload';
import RecordingsList from '@/components/RecordingsList';

export default function Home() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(
    null
  );
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Check backend connection
  const checkBackendConnection = useCallback(async () => {
    const isConnected = await MeetingAssistantAPI.healthCheck();
    setIsBackendConnected(isConnected);
    return isConnected;
  }, []);

  // Load recordings from backend
  const loadRecordings = useCallback(async () => {
    try {
      const recordingsData = await MeetingAssistantAPI.getRecordings();
      setRecordings(recordingsData);
    } catch (error) {
      console.error('Failed to load recordings:', error);
      showNotification('error', 'Failed to load recordings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Show notification
  const showNotification = (
    type: 'success' | 'error' | 'info',
    message: string
  ) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      await checkBackendConnection();
      await loadRecordings();
    };
    init();
  }, [checkBackendConnection, loadRecordings]);

  // Handle upload events
  const handleUploadStart = (filename: string) => {
    showNotification('info', `Uploading ${filename}...`);
  };

  const handleUploadComplete = () => {
    showNotification(
      'success',
      'Upload successful! Processing will begin shortly.'
    );
    loadRecordings(); // Refresh the list
  };

  const handleUploadError = (error: string) => {
    showNotification('error', `Upload failed: ${error}`);
  };

  const renderNotification = () => {
    if (!notification) return null;

    const bgColor = {
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    return (
      <div
        className={`fixed top-4 right-4 z-50 p-4 rounded-lg border max-w-md ${bgColor[notification.type]}`}
      >
        <p className="text-sm font-medium">{notification.message}</p>
      </div>
    );
  };

  const renderConnectionStatus = () => {
    if (isBackendConnected === null) return null;

    return (
      <div className="flex items-center space-x-2 text-sm">
        {isBackendConnected ? (
          <>
            <Wifi className="w-4 h-4 text-green-500" />
            <span className="text-green-600">Backend Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-red-500" />
            <span className="text-red-600">Backend Disconnected</span>
            <button
              onClick={checkBackendConnection}
              className="ml-2 text-blue-600 hover:text-blue-800"
              title="Retry connection"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  CHIP Communication Coach
                </h1>
                <p className="text-sm text-gray-600">
                  AI-Powered Meeting Intelligence
                </p>
              </div>
            </div>

            {renderConnectionStatus()}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isBackendConnected === false ? (
          // Backend Disconnected State
          <div className="text-center py-12">
            <WifiOff className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Backend Disconnected
            </h2>
            <p className="text-gray-600 mb-6">
              Unable to connect to the backend server. Please make sure your
              backend is running.
            </p>
            <button
              onClick={checkBackendConnection}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Retry Connection</span>
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Upload Section */}
            <section>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Transform Your Meeting Recordings
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Upload your meeting recordings and get AI-powered insights
                  including transcripts, summaries, action items, and
                  communication analytics.
                </p>
              </div>

              <FileUpload
                onUploadStart={handleUploadStart}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </section>

            {/* Recordings Section */}
            <section>
              {isLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 mx-auto text-blue-500 animate-spin mb-4" />
                  <p className="text-gray-600">Loading recordings...</p>
                </div>
              ) : (
                <RecordingsList
                  recordings={recordings}
                  onRefresh={loadRecordings}
                />
              )}
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-500 text-sm">
            <p>CHIP Communication Coach MVP • Powered by AI</p>
          </div>
        </div>
      </footer>

      {/* Notifications */}
      {renderNotification()}
    </div>
  );
}
