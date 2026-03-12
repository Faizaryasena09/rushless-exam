'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

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
  <label htmlFor={id} className={`flex items-center justify-between p-4 rounded-lg transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
    <div>
      <span className={`text-sm font-medium ${disabled ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>{label}</span>
      {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
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
      <div className={`block w-14 h-8 rounded-full transition-colors ${checked ? (disabled ? 'bg-indigo-300' : 'bg-indigo-600') : (disabled ? 'bg-slate-200 dark:bg-slate-600' : 'bg-slate-300 dark:bg-slate-600')}`}></div>
      <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${checked ? 'transform translate-x-6' : ''}`}></div>
    </div>
  </label>
);

// --- Reusable Segmented Control ---
const SegmentedControl = ({ name, options, value, onChange }) => (
  <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
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
        <span className={`block w-full py-1.5 text-sm font-semibold rounded-md transition-all ${option.disabled ? 'text-slate-400 dark:text-slate-500' : (value === option.value ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50')}`}>
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
  const [subjectId, setSubjectId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [requireSafeBrowser, setRequireSafeBrowser] = useState(false);
  const [requireSeb, setRequireSeb] = useState(false);
  const [sebConfigKey, setSebConfigKey] = useState('');
  const [timerMode, setTimerMode] = useState('sync'); // 'sync' or 'async'
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [minTimeMinutes, setMinTimeMinutes] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);

  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionType, setInstructionType] = useState('template');
  const [customInstructions, setCustomInstructions] = useState('');

  // Results Settings
  const [showResult, setShowResult] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Track if initial load is done to prevent auto-saving on mount
  const isInitialLoadDone = useRef(false);
  // Ref for the timeout to allow debounce saving
  const saveTimeoutRef = useRef(null);

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
      const [settingsRes, classesRes, subjectsRes] = await Promise.all([
        fetch(`/api/exams/settings?examId=${examId}`),
        fetch('/api/classes'),
        fetch('/api/subjects')
      ]);

      if (!settingsRes.ok) {
        const data = await settingsRes.json();
        throw new Error(data.message || 'Failed to fetch exam data');
      }
      const data = await settingsRes.json();

      if (classesRes.ok) {
        const classesData = await classesRes.json();
        setAvailableClasses(Array.isArray(classesData) ? classesData : []);
      }
      if (subjectsRes.ok) {
        const subjectsData = await subjectsRes.json();
        setAvailableSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      }

      setExamName(data.exam_name || '');
      setDescription(data.description || '');
      setSubjectId(data.subject_id || '');
      setStartTime(toDateTimeLocal(data.start_time));
      setEndTime(toDateTimeLocal(data.end_time));
      setShuffleQuestions(data.shuffle_questions || false);
      setShuffleAnswers(data.shuffle_answers || false);
      setTimerMode(data.timer_mode || 'sync');
      setDurationMinutes(data.duration_minutes || 60);
      setMinTimeMinutes(data.min_time_minutes || 0);
      setMaxAttempts(data.max_attempts || 1);
      setRequireSafeBrowser(!!data.require_safe_browser);
      setRequireSeb(!!data.require_seb);
      setSebConfigKey(data.seb_config_key || '');
      setShowInstructions(!!data.show_instructions);
      setInstructionType(data.instruction_type || 'template');
      setCustomInstructions(data.custom_instructions || '');
      setShowResult(!!data.show_result);
      setShowAnalysis(!!data.show_analysis);
      setSelectedClasses(data.allowed_classes || []);

      // Marking initial load completed so auto-save works exclusively on user edits
      setTimeout(() => {
        isInitialLoadDone.current = true;
      }, 500);

    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchExamData();
  }, [fetchExamData]);

  const handleToggleClass = (classId) => {
    setSelectedClasses(prev => {
      if (prev.includes(classId)) {
        return prev.filter(id => id !== classId);
      } else {
        return [...prev, classId];
      }
    });
  };

  const executeAutoSave = async () => {
    setSaving(true);
    const savingToastId = toast.loading('Saving changes...');

    const examDetailsPromise = fetch('/api/exams', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: examId,
        exam_name: examName,
        description: description,
        subject_id: subjectId || null,
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
        minTimeMinutes: minTimeMinutes,
        maxAttempts: maxAttempts,
        requireSafeBrowser: requireSafeBrowser,
        requireSeb: requireSeb,
        sebConfigKey: sebConfigKey,
        showInstructions: showInstructions,
        instructionType: instructionType,
        customInstructions: customInstructions,
        showResult: showResult,
        showAnalysis: showAnalysis,
        allowedClasses: selectedClasses
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

      toast.success('All changes saved successfully.', { id: savingToastId });
    } catch (err) {
      toast.error(err.message, { id: savingToastId });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!isInitialLoadDone.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Auto-save debounce logic ensures execution 1s after the last state shift.
    saveTimeoutRef.current = setTimeout(() => {
      executeAutoSave();
    }, 1000);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [
    examName, description, subjectId, startTime, endTime, shuffleQuestions, shuffleAnswers,
    timerMode, durationMinutes, minTimeMinutes, maxAttempts, requireSafeBrowser, requireSeb, sebConfigKey, selectedClasses, showInstructions, instructionType, customInstructions, showResult, showAnalysis
  ]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-8 animate-pulse"></div>
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-6">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-2 animate-pulse"></div>
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-full animate-pulse"></div>
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-2 animate-pulse"></div>
          <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg w-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100">{examName || 'Manage Exam'}</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 mt-1">Edit exam details, settings, and questions. Configuration changes are saved automatically.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        <div className="md:col-span-2">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-4">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Exam Details</h2>
              {saving && <span className="text-sm font-semibold text-indigo-500 animate-pulse">Saving...</span>}
            </div>

            <div>
              <label htmlFor="examName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Exam Name</label>
              <input
                id="examName"
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                disabled={saving && false}
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                rows="4"
                disabled={saving && false}
              />
            </div>

            <div>
              <label htmlFor="subjectId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mata Pelajaran</label>
              <select
                id="subjectId"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                disabled={saving && false}
              >
                <option value="">Pilih Mata Pelajaran...</option>
                {availableSubjects.map((sbj) => (
                  <option key={sbj.id} value={sbj.id}>{sbj.name}</option>
                ))}
              </select>
            </div>

            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-4 pt-4">Exam Settings</h2>

            <div className="space-y-4">
              {/* --- Assign Classes Section --- */}
              <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Assign to Classes</label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Select the classes eligible to take this exam. If no class is selected, the exam will be hidden from all students.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableClasses.map((cls) => (
                    <label key={cls.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls.id)}
                        onChange={() => handleToggleClass(cls.id)}
                        className="w-4 h-4 text-indigo-600 dark:text-indigo-500 rounded focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-600 dark:bg-slate-700"
                        disabled={saving && false}
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{cls.class_name}</span>
                    </label>
                  ))}
                  {availableClasses.length === 0 && <p className="text-xs text-red-500 dark:text-red-400 italic col-span-3">No classes found. Please create classes first.</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Timer Mode</label>
                <SegmentedControl
                  name="timer-mode"
                  options={[
                    { label: 'Synchronous', value: 'sync', disabled: !isScheduled || (saving && false) },
                    { label: 'Asynchronous', value: 'async', disabled: saving && false },
                  ]}
                  value={timerMode}
                  onChange={setTimerMode}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {timerMode === 'sync'
                    ? 'All students have the same start and end time. Duration is fixed by the schedule.'
                    : 'Each student gets a fixed duration from when they start. If a schedule is set, it acts as an availability window.'
                  }
                </p>
              </div>

              {(timerMode === 'async' || !isScheduled) && (
                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Exam Duration (minutes)</label>
                  <input
                    id="duration"
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || '')}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                    disabled={saving && false}
                    min="1"
                  />
                </div>
              )}

              <div>
                <label htmlFor="minTime" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Submission Lockout from End (minutes)</label>
                <input
                  id="minTime"
                  type="number"
                  value={minTimeMinutes}
                  onChange={(e) => setMinTimeMinutes(parseInt(e.target.value, 10))}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                  disabled={saving && false}
                  min="0"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Set to 0 to disable. Disables submission in the final minutes of the exam. E.g., for a 10-minute exam, a setting of '1' means submission is disabled during the last minute.
                </p>
              </div>

              <div>
                <label htmlFor="maxAttempts" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Attempts</label>
                <input
                  id="maxAttempts"
                  type="number"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(parseInt(e.target.value, 10))}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                  disabled={saving && false}
                  min="1"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Maximum number of times a student can attempt this exam.
                </p>
              </div>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
              <Switch
                id="req-safe-browser"
                label="Use Rushless Safer"
                description="Students must use the Rushless Safer application to take this exam."
                checked={requireSafeBrowser}
                onChange={() => setRequireSafeBrowser(!requireSafeBrowser)}
                disabled={saving && false}
              />
              <Switch
                id="req-seb"
                label="Use SEB (Safe Exam Browser)"
                description="Students must use Safe Exam Browser to take this exam."
                checked={requireSeb}
                onChange={() => setRequireSeb(!requireSeb)}
                disabled={saving && false}
              />
              {requireSeb && (
                <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-b-lg">
                  <label htmlFor="sebConfigKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SEB Config Key</label>
                  <input
                    id="sebConfigKey"
                    type="text"
                    value={sebConfigKey}
                    onChange={(e) => setSebConfigKey(e.target.value)}
                    placeholder="Enter X-SafeExamBrowser-ConfigKey string... (optional)"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                    disabled={saving && false}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Validating the Config Key ensures the student hasn't altered the SEB configuration. Leave blank to only check if the browser is SEB.
                  </p>
                </div>
              )}
              <Switch
                id="shuffle-questions"
                label="Acak Urutan Soal"
                description="Setiap siswa akan mendapatkan urutan soal yang berbeda."
                checked={shuffleQuestions}
                onChange={() => setShuffleQuestions(!shuffleQuestions)}
                disabled={saving && false}
              />
              <Switch
                id="shuffle-answers"
                label="Acak Urutan Jawaban"
                description="Opsi jawaban pada soal pilihan ganda akan diacak."
                checked={shuffleAnswers}
                onChange={() => setShuffleAnswers(!shuffleAnswers)}
                disabled={saving && false}
              />
            </div>

            <div className="space-y-4 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <Switch
                id="show-instructions"
                label="Tampilkan Petunjuk Pengerjaan"
                description="Halaman petunjuk akan muncul sebelum siswa menekan tombol 'Mulai Ujian'."
                checked={showInstructions}
                onChange={() => setShowInstructions(!showInstructions)}
                disabled={saving && false}
              />
              {showInstructions && (
                <div className="pl-4 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-4 pt-2">
                  <SegmentedControl
                    name="instruction-type"
                    options={[
                      { label: 'Gunakan Template Default', value: 'template', disabled: saving && false },
                      { label: 'Gunakan Teks Kustom', value: 'custom', disabled: saving && false },
                    ]}
                    value={instructionType}
                    onChange={setInstructionType}
                  />

                  {instructionType === 'template' ? (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-4 prose prose-sm prose-slate dark:prose-invert">
                      <h4 className="font-bold">✨ Preview Petunjuk Default</h4>
                      <ul>
                        <li>Berdoalah sebelum mengerjakan ujian.</li>
                        <li>Periksa daftar soal untuk melihat ragam pertanyaan yang tersedia.</li>
                        <li>Silakan gunakan fitur <strong>Tandai Ragu</strong> jika belum yakin dengan jawaban.</li>
                        <li>Kerjakan dengan jujur dan teliti.</li>
                        <li>Pastikan untuk menekan <strong>Selesai Ujian</strong> sebelum waktu habis.</li>
                      </ul>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="customInstructions" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teks Petunjuk Kustom (Mendukung HTML dasar)</label>
                      <textarea
                        id="customInstructions"
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="Contoh: <p>Selamat mengerjakan...</p><ul><li>Aturan 1</li></ul>"
                        className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none font-mono text-sm"
                        rows="6"
                        disabled={saving && false}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
              <Switch
                id="show-result"
                label="Tampilkan Hasil"
                description="Siswa dapat melihat skor akhir mereka setelah menyelesaikan ujian."
                checked={showResult}
                onChange={(e) => {
                  const val = !showResult;
                  setShowResult(val);
                  if (!val) setShowAnalysis(false); // Cascade disable
                }}
                disabled={saving && false}
              />
              {showResult && (
                <div className="pl-4">
                  <Switch
                    id="show-analysis"
                    label="Tampilkan Analisis Jawaban"
                    description="Siswa dapat melihat daftar soal mana yang dijawab benar, salah, beserta kunci jawabannya."
                    checked={showAnalysis}
                    onChange={() => setShowAnalysis(!showAnalysis)}
                    disabled={saving && false}
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Availability Start Time (Optional)
              </label>
              <input
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                disabled={saving && false}
              />
            </div>

            <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Availability End Time (Optional)
              </label>
              <input
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                disabled={saving && false}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
              <Link href="/dashboard/exams" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors">
                &larr; Back to exams list
              </Link>
            </div>
          </div>
        </div>

        <div className="md:col-span-1">
          <div className="space-y-6 sticky top-24">
            <div className="p-6 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl text-center">
              <h3 className="font-bold text-sky-800 dark:text-sky-400 text-lg">Manage Questions</h3>
              <p className="text-sm text-sky-700 dark:text-sky-300 mt-1 mb-4">Add, edit, or import questions for this exam.</p>
              <Link href={`/dashboard/exams/questions/${examId}`} className="inline-flex items-center justify-center w-full px-5 py-2.5 bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 active:scale-95 text-white text-sm font-semibold rounded-lg transition-all shadow-md shadow-sky-200 dark:shadow-sky-900/30">
                Go to Questions &rarr;
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}