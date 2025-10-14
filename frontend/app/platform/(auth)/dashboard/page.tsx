'use client';

import FileUploadZone from '@/components/FileUploadZone';
import { useState } from 'react';

export default function DashboardPage() {
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleUploadComplete = (response: {
    jobId?: string;
    message?: string;
  }) => {
    console.log('Upload complete:', response);
    setUploadSuccess(true);
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
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Hours Analyzed</p>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600 mb-1">This Month</p>
          <p className="text-3xl font-bold text-gray-900">0</p>
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

      {/* Recent Meetings */}
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Recent Meetings
        </h2>
        <div className="text-center py-12 text-gray-500">
          <div className="text-5xl mb-4">🎯</div>
          <p className="text-lg mb-2">No meetings yet</p>
          <p className="text-sm">Upload your first meeting to get started</p>
        </div>
      </div>
    </div>
  );
}
