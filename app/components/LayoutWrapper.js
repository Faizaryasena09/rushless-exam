'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();

  // Pages where the footer should not be shown
  const noFooterPages = ['/'];

  const showFooter = !noFooterPages.includes(pathname);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
