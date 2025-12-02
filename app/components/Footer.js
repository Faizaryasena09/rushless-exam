export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white border-t border-gray-100 mt-auto">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Brand & Tagline Section */}
          <div className="text-center md:text-left">
            <h2 className="text-lg font-bold tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                RUSHLESS
              </span>
              <span className="text-gray-800">EXAM</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Empowering students, simplified.
            </p>
          </div>

          {/* Navigation Links (Dummy) */}
          <div className="flex gap-6 text-sm font-medium text-gray-500">
            <a href="#" className="hover:text-indigo-600 transition-colors duration-200">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-indigo-600 transition-colors duration-200">
              Terms of Service
            </a>
            <a href="#" className="hover:text-indigo-600 transition-colors duration-200">
              Support
            </a>
          </div>

          {/* Copyright Section */}
          <div className="text-xs text-gray-400 font-medium">
            &copy; {currentYear} Rushless Exam. All Rights Reserved.
          </div>
          
        </div>
      </div>
    </footer>
  );
}