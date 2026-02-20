"use client";
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On component mount, check screen size and set sidebar to open for large screens
    if (window.innerWidth >= 1024) { // 1024px is Tailwind's 'lg' breakpoint
      setSidebarOpen(true);
    }

    async function fetchUserSession() {
      try {
        const response = await fetch('/api/user-session');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else if (response.status === 401) {
          // Session invalid/expired (or forced logout) - Redirect to login
          window.location.href = '/?redirect=' + encodeURIComponent(pathname);
        }
      } catch (error) {
        console.error('Failed to fetch user session:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserSession();

    // Poll session status every 2 seconds to check for force logout
    const interval = setInterval(fetchUserSession, 2000);
    return () => clearInterval(interval);
  }, []); // Empty dependency array ensures this runs only once on mount

  const isStudent = user?.roleName === 'student';

  if (loading) {
    return (
      <div className="relative flex h-screen bg-gray-100 overflow-hidden">
        <div className="flex-1 flex flex-col">
          <Header user={null} isLoading={true} showToggleButton={false} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="container mx-auto px-6 py-8">
              <div>Loading...</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen bg-gray-100 overflow-hidden">
      {!isStudent && <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen && !isStudent ? 'lg:ml-64' : ''}`}>
        <Header
          user={user}
          isLoading={loading}
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          showToggleButton={!isStudent}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
