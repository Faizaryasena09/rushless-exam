import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white/80 backdrop-blur-md border-t border-slate-200/60 mt-auto transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-0">

          {/* Left Side: Brand & Copyright */}
          <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3 text-center md:text-left">
            <h2 className="text-sm font-bold tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                RUSHLESS
              </span>
              <span className="text-slate-800">EXAM</span>
            </h2>

            <span className="hidden md:block text-slate-300">|</span>

            <p className="text-xs text-slate-500">
              &copy; {currentYear} All Rights Reserved.
            </p>
          </div>

          {/* Right Side: Links */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/privacy"
              className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors duration-200"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors duration-200"
            >
              Terms
            </Link>
            <Link
              href="/support"
              className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors duration-200"
            >
              Support
            </Link>
          </div>

        </div>
      </div>
    </footer>
  );
}