'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * A thin, animated progress bar that appears at the top of the page
 * immediately when navigation starts. This eliminates the "stuck" feeling
 * caused by Next.js lazy-compiling pages in dev mode.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  const prevPathRef = useRef(pathname + searchParams.toString());

  // Listen for link clicks globally - show bar immediately
  useEffect(() => {
    const handleLinkClick = (e) => {
      const anchor = e.target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      // Only handle internal navigation
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;

      const current = pathname + searchParams.toString();
      if (href === current || href === pathname) return; // Same page, skip

      startProgress();
    };

    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
  }, [pathname, searchParams]);

  // Detect when navigation is complete (URL changes)
  useEffect(() => {
    const current = pathname + searchParams.toString();
    if (current !== prevPathRef.current) {
      prevPathRef.current = current;
      completeProgress();
    }
  }, [pathname, searchParams]);

  const startProgress = () => {
    setVisible(true);
    setProgress(15);

    // Gradually increment progress to simulate loading
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(timerRef.current);
          return 85; // Hold at 85% until navigation completes
        }
        // Slow down progress as it approaches 85%
        const increment = (85 - prev) * 0.08;
        return prev + Math.max(increment, 0.5);
      });
    }, 100);
  };

  const completeProgress = () => {
    clearInterval(timerRef.current);
    setProgress(100);
    // Hide after animation completes
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 400);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
          transition: progress === 100 ? 'width 0.2s ease-out' : 'width 0.3s ease',
          borderRadius: '0 2px 2px 0',
          boxShadow: '0 0 8px rgba(99, 102, 241, 0.7)',
        }}
      />
    </div>
  );
}
