import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth-server';
import AppHeader from '@/components/AppHeader';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/platform/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader userEmail={user.email || ''} />
      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
