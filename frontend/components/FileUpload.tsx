'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, Play, Loader2 } from 'lucide-react';
import { MeetingAssistantAPI } from '@/lib/api-client';

interface FileUploadProps {
  onUploadStart: (filename: string) => void;
  onUploadComplete: (recordingId: string) => void;
  onUploadError: (error: string) => void;
}

export default function FileUpload({
  onUploadStart,
  onUploadComplete,
  onUploadError,
}: FileUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSampleProcessing, setIsSampleProcessing] = useState(false);

  // Supported file formats
  const acceptedFormats = {
    'video/*': ['.mp4', '.webm', '.mov', '.avi'],
    'audio/*': ['.mp3', '.wav', '.m4a', '.aac'],
  };

  const maxFileSize = 200 * 1024 * 1024; // 200MB

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors.some((error) => error.code === 'file-too-large')) {
          onUploadError('File size must be less than 200MB');
        } else if (
          rejection.errors.some((error) => error.code === 'file-invalid-type')
        ) {
          onUploadError(
            'Please upload a video (MP4, WebM, MOV) or audio (MP3, WAV, M4A) file'
          );
        } else {
          onUploadError('Invalid file. Please try again.');
        }
        return;
      }

      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setIsUploading(true);
      setUploadProgress(0);
      onUploadStart(file.name);

      try {
        const result = await MeetingAssistantAPI.uploadFile(
          file,
          (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            }
          }
        );

        if (result.success && result.recordingId) {
          onUploadComplete(result.recordingId);
        } else {
          onUploadError(result.error || 'Upload failed');
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';
        onUploadError(errorMessage);
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [onUploadStart, onUploadComplete, onUploadError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats,
    maxSize: maxFileSize,
    multiple: false,
  });

  const handleSampleUpload = async () => {
    setIsSampleProcessing(true);
    const sampleFilename = 'Beau_Lauren (2024-06-20 15_06 GMT-4).mp4';
    onUploadStart(sampleFilename);

    try {
      const result =
        await MeetingAssistantAPI.processSampleRecording(sampleFilename);

      if (result.success && result.recordingId) {
        onUploadComplete(result.recordingId);
      } else {
        onUploadError(result.error || 'Sample processing failed');
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Sample processing failed';
      onUploadError(errorMessage);
    } finally {
      setIsSampleProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* File Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="space-y-4">
          {isUploading ? (
            <>
              <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-700">
                  Uploading...
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500">
                  {uploadProgress}% complete
                </p>
              </div>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto text-gray-400" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-700">
                  {isDragActive
                    ? 'Drop your file here'
                    : 'Upload a meeting recording'}
                </p>
                <p className="text-sm text-gray-500">
                  Drag & drop or click to select a file
                </p>
                <p className="text-xs text-gray-400">
                  Supports MP4, WebM, MOV, MP3, WAV • Max 200MB
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center justify-center">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="px-4 text-sm text-gray-500 bg-white">or</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      {/* Sample Recording Option */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Play className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Try a Sample Recording
              </h3>
              <p className="text-sm text-gray-600">
                Use our demo recording to see the AI analysis in action
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Beau & Lauren Meeting (2024-06-20) • ~10 minutes
              </p>
            </div>
          </div>

          <button
            onClick={handleSampleUpload}
            disabled={isSampleProcessing || isUploading}
            className={`
              px-6 py-2 rounded-lg font-medium transition-colors
              ${
                isSampleProcessing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }
            `}
          >
            {isSampleProcessing ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              'Analyze Sample'
            )}
          </button>
        </div>
      </div>

      {/* Upload Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">💡 Upload Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Clear audio quality improves transcription accuracy</li>
          <li>• Shorter recordings (under 30 min) process faster</li>
          <li>
            • Multiple speakers? Great! We&apos;ll analyze communication
            patterns
          </li>
          <li>• Processing typically takes 2-5 minutes</li>
        </ul>
      </div>
    </div>
  );
}
