'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/user-session');
        if (!res.ok) {
          throw new Error('Not authenticated');
        }
        const data = await res.json();
        if (!data.user) {
          throw new Error('User data not found in session');
        }
        setUser(data.user);
      } catch (error) {
        console.error('Session check failed:', error);
        router.push('/'); // Redirect to login if not authenticated
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [router]);

  if (loading) {
    return <h1 className="text-2xl font-bold text-center mt-10">Loading...</h1>;
  }

  if (!user) {
    return null; // Or some other placeholder while redirecting
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Welcome to your Dashboard, {user.username}!</h1>
      <p className="mb-6">From here you can manage your exams.</p>
      <Link
        href="/dashboard/ujian"
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
      >
        Lihat Daftar Ujian
      </Link>
    </div>
  );
}
