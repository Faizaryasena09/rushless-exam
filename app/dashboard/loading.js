export default function Loading() {
    return (
      <div className="animate-pulse space-y-8 p-4">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-48"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64"></div>
          </div>
          <div className="flex gap-3">
            <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl w-32 hidden md:block"></div>
            <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl w-32"></div>
          </div>
        </div>
        
        {/* Content Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col h-64">
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
              </div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
              <div className="space-y-2 mt-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700/50 flex gap-2">
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-1/2"></div>
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
