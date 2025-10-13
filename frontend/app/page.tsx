'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import LoginForm from '@/components/auth/LoginForm';
import OTPVerification from '@/components/auth/OTPVerification';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session && !loading) {
      // If user is authenticated, middleware will handle redirecting
      // but we can also programmatically navigate if needed
      router.push('/dashboard');
    }
  }, [session, loading, router]);

  const handleEmailSent = (email: string) => {
    setEmailSent(email);
  };

  const handleOTPSuccess = () => {
    // The auth state will be updated automatically by the AuthProvider
    // and middleware will handle redirecting to appropriate page
  };

  const handleBackToLogin = () => {
    setEmailSent(null);
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

  if (session) {
    // Show loading while redirecting
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      {emailSent ? (
        <OTPVerification
          email={emailSent}
          onBack={handleBackToLogin}
          onSuccess={handleOTPSuccess}
        />
      ) : (
        <LoginForm onEmailSent={handleEmailSent} />
      )}
    </div>
  );
}
