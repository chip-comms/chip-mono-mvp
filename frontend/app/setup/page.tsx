'use client';

import { useAuth } from '@/lib/auth-context';
import SetupTutorial from '@/components/auth/SetupTutorial';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SetupPage() {
  const { user, loading, refreshAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.first_login_completed) {
      // If user has already completed setup, redirect to dashboard
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSetupComplete = async (name: string) => {
    // Refresh auth data to get updated user info
    await refreshAuth();
    // Redirect to dashboard
    router.push('/dashboard');
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
    // This should be handled by middleware, but just in case
    router.push('/');
    return null;
  }

  if (user.first_login_completed) {
    // Show loading while redirecting
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <SetupTutorial onComplete={handleSetupComplete} />
    </div>
  );
}
