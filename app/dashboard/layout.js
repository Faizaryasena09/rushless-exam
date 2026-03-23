"use client";
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Toaster } from 'sonner';
import { useLanguage } from '../context/LanguageContext';
import { UserProvider } from '../context/UserContext';

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On component mount, check screen size and set sidebar to open for large screens
    if (window.innerWidth >= 1024) { // 1024px is Tailwind's 'lg' breakpoint
      setSidebarOpen(true);
    }

    let sse;
    let handleUnload;
    const fetchUserSession = async () => {
      try {
        const response = await fetch('/api/user-session');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else if (response.status === 401) {
          window.location.href = '/?redirect=' + encodeURIComponent(pathname);
        }
      } catch (error) {
        console.error('Failed to fetch user session:', error);
      } finally {
        setLoading(false);
      }
    };

    const setupSessionStream = () => {
      if (sse) sse.close();
      
      sse = new EventSource('/api/user-session/stream');
      
      // Fallback: Notify server immediately on tab closure
      const handleUnloadAction = () => {
          // Use sendBeacon for reliable delivery on closure
          navigator.sendBeacon('/api/user-session/offline');
      };
      handleUnload = handleUnloadAction;

      window.addEventListener('beforeunload', handleUnload);
      window.addEventListener('unload', handleUnload);

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'invalid' || data.status === 'expired') {
            sse.close();
            window.removeEventListener('beforeunload', handleUnload);
            window.removeEventListener('unload', handleUnload);
            window.location.href = '/?redirect=' + encodeURIComponent(pathname);
          } else if (data.status === 'active' && data.user) {
            setUser(data.user);
          }
        } catch (e) {
          console.error("Failed to parse session stream data", e);
        }
      };

      sse.onerror = (err) => {
        console.error("Session stream connection error, retrying in 10s...", err);
        sse.close();
        // Fallback to manual check and then try to restablish stream
        setTimeout(() => {
          fetchUserSession();
          setupSessionStream();
        }, 10000);
      };
    };

    fetchUserSession().then(() => {
      if (!isExamTaking) { // For exam taking, we might want to keep it simple or use the exam's own SSE
        setupSessionStream();
      }
    });

    return () => {
      if (sse) sse.close();
      if (handleUnload) {
        window.removeEventListener('beforeunload', handleUnload);
        window.removeEventListener('unload', handleUnload);
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  const isPreview = pathname.includes('/preview/');
  const isExamTaking = pathname.includes('/exams/kerjakan/');
  const isStudent = user?.roleName === 'student';

  if (loading) {
    return (
      <div className="relative flex h-screen bg-gray-100 dark:bg-slate-900 overflow-hidden">
        <div className="flex-1 flex flex-col">
          {(!isPreview && !isExamTaking) && <Header user={null} isLoading={true} showToggleButton={false} />}
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className={`container mx-auto ${isPreview ? 'px-0 py-0' : 'px-6 py-8'}`}>
              <div className="dark:text-slate-300">{!isPreview && t('layout_loading')}</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <UserProvider value={{ user, loading }}>
      <div className="relative flex h-screen bg-gray-100 dark:bg-slate-900 overflow-hidden">
        {(!isStudent && !isPreview && !isExamTaking) && <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${(sidebarOpen && !isStudent && !isPreview && !isExamTaking) ? 'lg:ml-64' : ''}`}>
          {(!isPreview && !isExamTaking) && (
            <Header
              user={user}
              isLoading={loading}
              toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              showToggleButton={!isStudent}
            />
          )}
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className={`w-full ${(isPreview || isExamTaking) ? 'px-0 py-0' : 'px-4 sm:px-6 py-4 sm:py-8'}`}>
              {children}
            </div>
          </main>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    </UserProvider>
  );
}
