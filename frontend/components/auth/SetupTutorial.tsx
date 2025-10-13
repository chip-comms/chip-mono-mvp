'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

interface SetupTutorialProps {
  onComplete?: (name: string) => void;
}

export default function SetupTutorial({ onComplete }: SetupTutorialProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!session) {
      setError('Authentication session not found');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/complete-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Setup failed');
      }

      onComplete?.(name.trim());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Setup failed. Please try again.'
      );
      console.error('Setup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Meeting Intelligence Assistant!
          </h1>
          <p className="text-gray-600 mb-4">Let&apos;s set up your workspace</p>
          <div className="flex items-center justify-center">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="ml-2 text-sm text-gray-600">Step 1 of 1</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-lg font-medium text-gray-900 mb-4 text-center"
            >
              What should we call you?
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              maxLength={100}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-center"
              disabled={isLoading}
              autoFocus
            />
            <p className="text-sm text-gray-500 mt-2 text-center">
              This will be used to personalize your workspace
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
          >
            {isLoading ? 'Creating your workspace...' : 'Create My Workspace'}
          </button>
        </form>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-gray-600 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Your personal workspace</span>{' '}
                will be created with your name, giving you a dedicated space to
                manage your meeting recordings and analysis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
