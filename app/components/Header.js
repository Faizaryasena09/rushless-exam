'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Header() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  const fetchUserSession = async () => {
    try {
      const res = await fetch('/api/user-session');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user session:', error);
      setUser(null);
    }
  };

  useEffect(() => {
    fetchUserSession();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null); // Clear user state
    router.push('/'); // Redirect to login
  };

  return (
    <header className="bg-gray-800 text-white p-4 w-full">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          RUSHLESSEXAM
        </Link>
        <div className="text-sm flex items-center gap-4">
          {user ? (
            <>
              <span>
                Hi, <strong>{user.username}</strong>
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-xs"
              >
                Logout
              </button>
            </>
          ) : (
            <span>Welcome, Guest</span>
          )}
        </div>
      </div>
    </header>
  );
}
