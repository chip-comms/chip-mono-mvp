'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const { user, organization, loading, signOut } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = () => {
    if (
      confirm(
        'Are you sure you want to delete your account? This action cannot be undone.'
      )
    ) {
      // TODO: Implement account deletion
      alert(
        'Account deletion functionality will be implemented in a future update.'
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Meeting Intelligence Assistant
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">
                  {user.full_name || user.email}
                </span>
                <span className="mx-2">•</span>
                <span className="text-blue-600">{user.role}</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-blue-600"
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome back, {user.full_name || user.email}!
            </h2>
            {organization && (
              <p className="text-lg text-gray-600 mb-4">
                Organization:{' '}
                <span className="font-medium text-blue-600">
                  {organization.name}
                </span>
              </p>
            )}
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">
                    Your workspace is ready! You can now start using the Meeting
                    Intelligence Assistant.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile Information */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Profile Information
          </h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="text-sm text-gray-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Full Name</dt>
              <dd className="text-sm text-gray-900">
                {user.full_name || 'Not set'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Role</dt>
              <dd className="text-sm text-gray-900 capitalize">{user.role}</dd>
            </div>
            {organization && (
              <>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Organization
                  </dt>
                  <dd className="text-sm text-gray-900">{organization.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Organization Slug
                  </dt>
                  <dd className="text-sm text-gray-900 font-mono">
                    {organization.slug}
                  </dd>
                </div>
              </>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Setup Status
              </dt>
              <dd className="text-sm text-gray-900">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Complete
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Basic Navigation Structure */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                Upload Recording
              </h4>
              <p className="text-sm text-gray-500 mb-3">
                Upload a meeting recording for AI analysis
              </p>
              <button
                disabled
                className="text-sm text-blue-600 hover:text-blue-500 disabled:text-gray-400"
              >
                Coming soon →
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                View Analytics
              </h4>
              <p className="text-sm text-gray-500 mb-3">
                Review communication metrics and insights
              </p>
              <button
                disabled
                className="text-sm text-blue-600 hover:text-blue-500 disabled:text-gray-400"
              >
                Coming soon →
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                Settings
              </h4>
              <p className="text-sm text-gray-500 mb-3">
                Manage your workspace preferences
              </p>
              <button
                disabled
                className="text-sm text-blue-600 hover:text-blue-500 disabled:text-gray-400"
              >
                Coming soon →
              </button>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Account Actions
          </h3>
          <div className="space-y-4">
            <button
              onClick={handleDeleteAccount}
              className="inline-flex items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Delete Account
            </button>
            <p className="text-sm text-gray-500">
              This will permanently delete your account and all associated data.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
