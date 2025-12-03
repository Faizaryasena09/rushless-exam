'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// Helper to format dates for datetime-local input
const toDateTimeLocal = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  try {
    return date.toISOString().slice(0, 16);
  } catch (error) {
    return '';
  }
};

// --- Reusable Switch Component ---
const Switch = ({ id, label, description, checked, onChange, disabled }) => (
    <label htmlFor={id} className={`flex items-center justify-between p-4 rounded-lg transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'}`}>
        <div>
            <span className={`text-sm font-medium ${disabled ? 'text-slate-400' : 'text-slate-800'}`}>{label}</span>
            {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
        </div>
        <div className="relative">
            <input 
                id={id}
                type="checkbox" 
                className="sr-only" 
                checked={checked}
                onChange={onChange}
                disabled={disabled}
            />
            <div className={`block w-14 h-8 rounded-full transition-colors ${checked ? (disabled ? 'bg-indigo-300' : 'bg-indigo-600') : (disabled ? 'bg-slate-200' : 'bg-slate-300')}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${checked ? 'transform translate-x-6' : ''}`}></div>
        </div>
    </label>
);

// --- Reusable Segmented Control ---
const SegmentedControl = ({ name, options, value, onChange }) => (
    <div className="flex items-center p-1 bg-slate-200 rounded-lg">
        {options.map(option => (
            <label key={option.value} className={`flex-1 text-center relative ${option.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input 
                    type="radio" 
                    name={name}
                    value={option.value}
                    checked={value === option.value}
                    onChange={(e) => onChange(e.target.value)}
                    className="sr-only"
                    disabled={option.disabled}
                />
                <span className={`block w-full py-1.5 text-sm font-semibold rounded-md transition-all ${option.disabled ? 'text-slate-400' : (value === option.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50')}`}>
                    {option.label}
                </span>
            </label>
        ))}
    </div>
);


export default function ManageExamPage() {
  const { id: examId } = useParams();
  
  const [examName, setExamName] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [timerMode, setTimerMode] = useState('sync'); // 'sync' or 'async'
  const [durationMinutes, setDurationMinutes] = useState(60);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const isScheduled = startTime && endTime;

  // Effect to enforce async mode if exam is not scheduled
  useEffect(() => {
    if (!isScheduled) {
        setTimerMode('async');
    }
  }, [isScheduled]);

  const fetchExamData = useCallback(async () => {
    if (!examId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/exams/settings?examId=${examId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to fetch exam data');
      }
      const data = await res.json();
      setExamName(data.exam_name || '');
      setDescription(data.description || '');
      setStartTime(toDateTimeLocal(data.start_time));
      setEndTime(toDateTimeLocal(data.end_time));
      setShuffleQuestions(data.shuffle_questions || false);
      setShuffleAnswers(data.shuffle_answers || false);
      setTimerMode(data.timer_mode || 'sync');
      setDurationMinutes(data.duration_minutes || 60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchExamData();
  }, [fetchExamData]);

  const handleSaveAll = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const examDetailsPromise = fetch('/api/exams', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: examId,
        exam_name: examName,
        description: description,
      }),
    });

    const examSettingsPromise = fetch('/api/exams/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examId,
        startTime: startTime || null,
        endTime: endTime || null,
        shuffleQuestions: shuffleQuestions,
        shuffleAnswers: shuffleAnswers,
        timerMode: timerMode,
        durationMinutes: durationMinutes,
      }),
    });

    try {
      const [detailsRes, settingsRes] = await Promise.all([examDetailsPromise, examSettingsPromise]);

      if (!detailsRes.ok || !settingsRes.ok) {
        const detailsData = !detailsRes.ok ? await detailsRes.json() : null;
        const settingsData = !settingsRes.ok ? await settingsRes.json() : null;
        const errorMessage = (detailsData?.message || '') + ' ' + (settingsData?.message || '');
        throw new Error(errorMessage.trim() || 'An error occurred while saving.');
      }
      
      setSuccess('Exam details and settings saved successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
        <div className="container mx-auto p-4 md:p-6">
            <div className="h-10 bg-slate-200 rounded w-1/3 mb-4 animate-pulse"></div>
            <div className="h-6 bg-slate-200 rounded w-2/3 mb-8 animate-pulse"></div>
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-6">
                <div className="h-6 bg-slate-200 rounded w-1/4 mb-2 animate-pulse"></div>
                <div className="h-10 bg-slate-200 rounded-lg w-full animate-pulse"></div>
                <div className="h-6 bg-slate-200 rounded w-1/4 mb-2 animate-pulse"></div>
                <div className="h-24 bg-slate-200 rounded-lg w-full animate-pulse"></div>
            </div>
        </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-slate-800">Manage Exam</h1>
        <p className="text-lg text-slate-500 mt-1">Edit exam details, settings, and questions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        <div className="md:col-span-2">
            <form onSubmit={handleSaveAll} className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-6">
              <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-4">Exam Details</h2>
              <div>
                <label htmlFor="examName" className="block text-sm font-medium text-slate-700 mb-1">Exam Name</label>
                <input
                  id="examName"
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  rows="4"
                  disabled={saving}
                />
              </div>

              <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-4 pt-4">Exam Settings</h2>
              
              <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Timer Mode</label>
                    <SegmentedControl 
                        name="timer-mode"
                        options={[
                            { label: 'Synchronous', value: 'sync', disabled: !isScheduled || saving },
                            { label: 'Asynchronous', value: 'async', disabled: saving },
                        ]}
                        value={timerMode}
                        onChange={setTimerMode}
                    />
                     <p className="text-xs text-slate-500 mt-2">
                        {timerMode === 'sync' 
                            ? 'All students have the same start and end time. Duration is fixed by the schedule.' 
                            : 'Each student gets a fixed duration from when they start. If a schedule is set, it acts as an availability window.'
                        }
                    </p>
                </div>

                {(timerMode === 'async' || !isScheduled) && (
                    <div>
                        <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-1">Exam Duration (minutes)</label>
                        <input
                        id="duration"
                        type="number"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                        className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        disabled={saving}
                        min="1"
                        />
                    </div>
                )}
              </div>

              <div className="space-y-2 bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-200">
                <Switch
                    id="shuffle-questions"
                    label="Acak Urutan Soal"
                    description="Setiap siswa akan mendapatkan urutan soal yang berbeda."
                    checked={shuffleQuestions}
                    onChange={() => setShuffleQuestions(!shuffleQuestions)}
                    disabled={saving}
                />
                <Switch
                    id="shuffle-answers"
                    label="Acak Urutan Jawaban"
                    description="Opsi jawaban pada soal pilihan ganda akan diacak."
                    checked={shuffleAnswers}
                    onChange={() => setShuffleAnswers(!shuffleAnswers)}
                    disabled={saving}
                />
              </div>

              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-slate-700 mb-1">
                    Availability Start Time (Optional)
                </label>
                <input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  disabled={saving}
                />
              </div>

              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-slate-700 mb-1">
                    Availability End Time (Optional)
                </label>
                <input
                  id="endTime"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <Link href="/dashboard/exams" className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors">
                  &larr; Back to exams list
                </Link>
                <button 
                  type="submit" 
                  className="inline-flex items-center justify-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-lg transition-all shadow-md shadow-indigo-200 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save All Changes'}
                </button>
              </div>
               {success && <p className="mt-4 text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">{success}</p>}
               {error && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{error}</p>}
            </form>
        </div>

        <div className="md:col-span-1">
          <div className="space-y-6 sticky top-24">
            <div className="p-6 bg-sky-50 border border-sky-200 rounded-2xl text-center">
                <h3 className="font-bold text-sky-800 text-lg">Manage Questions</h3>
                <p className="text-sm text-sky-700 mt-1 mb-4">Add, edit, or import questions for this exam.</p>
                <Link href={`/dashboard/exams/questions/${examId}`} className="inline-flex items-center justify-center w-full px-5 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-sm font-semibold rounded-lg transition-all shadow-md shadow-sky-200">
                    Go to Questions &rarr;
                </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}