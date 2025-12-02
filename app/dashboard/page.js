'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        // This is a placeholder. In a real app, you'd have an API route
        // to check session status and return user data.
        // For now, we'll simulate a logged-in user.
        // Or, we could fetch from an /api/user endpoint for the actual session.

        // For now, let's just assume if we reach here, user is logged in.
        // A more robust solution involves a dedicated API endpoint to get session user.
        // For demonstration, let's fetch session info
        const res = await fetch('/api/user-session'); // We will create this endpoint next
        if (!res.ok) {
          throw new Error('Not authenticated');
        }
        const data = await res.json();
        setUser(data.user);
      } catch (error) {
        console.error('Failed to fetch user session:', error);
        router.push('/'); // Redirect to login if not authenticated
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-2xl font-bold text-center mb-6 text-black">Loading...</h1>
      </div>
    );
  }

  if (!user) {
    return null; // Redirect already handled by useEffect
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-2xl font-bold text-center mb-6 text-black">Welcome to your Dashboard, {user.username}!</h1>
      <p className="text-gray-700">This is a protected page.</p>
      <button
        onClick={async () => {
          await fetch('/api/logout', { method: 'POST' }); // We will create this logout endpoint
          router.push('/');
        }}
        className="mt-8 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
      >
        Logout
      </button>
    </main>
  );
}
