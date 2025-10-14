'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';

interface AppHeaderProps {
  userEmail: string;
}

export default function AppHeader({ userEmail }: AppHeaderProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <Link href="/platform/dashboard">
            <h1 className="text-2xl font-bold text-gray-900 hover:text-gray-700 transition">
              Meeting Intelligence
            </h1>
          </Link>
          <div className="flex gap-4 items-center">
            <span className="text-sm text-gray-600">{userEmail}</span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
