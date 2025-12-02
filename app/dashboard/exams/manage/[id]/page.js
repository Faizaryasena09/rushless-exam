'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Helper to format dates for datetime-local input
const toDateTimeLocal = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export default function ManageExamPage() {
  const { id: examId } = useParams();
  const router = useRouter();

  const [examName, setExamName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!examId) return;
    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await fetch(`/api/exams/settings?examId=${examId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to fetch settings');
        }
        const data = await res.json();
        setExamName(data.exam_name);
        setStartTime(toDateTimeLocal(data.start_time));
        setEndTime(toDateTimeLocal(data.end_time));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [examId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/exams/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId,
          startTime: startTime || null,
          endTime: endTime || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to save settings');
      }
      setSuccess('Settings saved successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-slate-200 max-w-2xl mx-auto">
        
        {loading && !examName && <div className="animate-pulse h-8 bg-slate-200 rounded w-3/4 mb-6"></div>}
        {examName && <h1 className="text-3xl font-bold text-slate-800 mb-2">{examName}</h1>}
        <p className="text-slate-500 mb-6">Set the start and end time for the exam. Leave blank for no time limit.</p>

        <div className="mb-8 p-4 bg-sky-50 border border-sky-200 rounded-lg">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-sky-800">Next Step</h3>
                    <p className="text-sm text-sky-600">After setting the time, manage the exam questions.</p>
                </div>
                <Link href={`/dashboard/exams/questions/${examId}`} className="inline-flex items-center justify-center px-5 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-sm font-semibold rounded-lg transition-all shadow-md shadow-sky-200">
                    Manage Questions
                </Link>
            </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label htmlFor="startTime" className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
            <input
              id="startTime"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="endTime" className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
            <input
              id="endTime"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <Link href="/dashboard/exams" className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors">
              &larr; Back to exams
            </Link>
            <button 
              type="submit" 
              className="inline-flex items-center justify-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-lg transition-all shadow-md shadow-indigo-200 disabled:bg-indigo-300 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

        {success && <p className="mt-4 text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">{success}</p>}
        {error && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{error}</p>}

      </div>
    </div>
  );
}
