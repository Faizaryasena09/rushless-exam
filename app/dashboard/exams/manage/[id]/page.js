'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, ClipboardList, ChevronDown, ChevronRight, Check, Plus, CheckCircle2, AlertCircle, AlertTriangle, Info, Clock } from 'lucide-react';
import dynamic from 'next/dynamic';
import { mysqlToDatetimeLocal, datetimeLocalToMysql, formatDateTime } from '@/app/lib/timezone';
import { useLanguage } from '@/app/context/LanguageContext';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

// Helper untuk mengisi <input type="datetime-local"> dari nilai DATETIME MySQL.
//
// PENTING:值 ini TIDAK dikonversi ke waktu lokal browser. Nilai datetime-local
// selalu "wall clock" tanpa zona, dan nilai di DB juga naive, jadi memakainya
// new Date() di sini akan menggeser jadwal ujian setiap kali disimpan dari
// browser yang berada di zona waktu berbeda.
const toDateTimeLocal = (dateString) => mysqlToDatetimeLocal(dateString);

// --- Reusable Switch Component ---
const Switch = ({ id, label, description, checked, onChange, disabled, standalone }) => (
  <label
    htmlFor={id}
    className={`flex items-start justify-between gap-4 transition-colors ${standalone ? 'p-0' : 'px-4 py-3'} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${standalone ? '' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
  >
    <span className="min-w-0">
      <span className={`block text-sm font-semibold ${disabled ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>{label}</span>
      {description && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>}
    </span>
    <span className="relative shrink-0 mt-0.5">
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className={`block w-11 h-6 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-slate-900 ${checked ? (disabled ? 'bg-slate-400' : 'bg-slate-900 dark:bg-white') : 'bg-slate-200 dark:bg-slate-700'}`} />
      <span className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </span>
  </label>
);

// --- Reusable Segmented Control ---
const SegmentedControl = ({ name, options, value, onChange }) => (
  <div role="radiogroup" aria-label={name} className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg gap-1">
    {options.map(option => (
      <label key={option.value} className={`flex-1 text-center relative ${option.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          type="radio"
          name={name}
          value={option.value}
          checked={value === option.value}
          onChange={(e) => onChange(e.target.value)}
          className="peer sr-only"
          disabled={option.disabled}
        />
        <span className={`block w-full py-1.5 px-2 text-sm font-semibold rounded-md transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400 ${option.disabled ? 'text-slate-400 dark:text-slate-500' : (value === option.value ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100')}`}>
          {option.label}
        </span>
      </label>
    ))}
  </div>
);


export default function ManageExamPage() {
  const { id: examId } = useParams();
  const { timezone, fmt } = useLanguage();

  const [examName, setExamName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [requireSafeBrowser, setRequireSafeBrowser] = useState(false);
  const [requireSeb, setRequireSeb] = useState(false);
  const [requireGeschool, setRequireGeschool] = useState(false);
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
  const [requireAllAnswered, setRequireAllAnswered] = useState(false);

  const [requireToken, setRequireToken] = useState(false);
  const [tokenType, setTokenType] = useState('static');
  const [currentToken, setCurrentToken] = useState('');
  const [liveAutoToken, setLiveAutoToken] = useState('');
  const [violationAction, setViolationAction] = useState('abaikan');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [openSections, setOpenSections] = useState({
    detail: true,
    jadwal: true,
    kelas: true,
    keamanan: true,
    token: true,
    petunjuk: false,
    hasil: true
  });

  // Track if initial load is done to prevent auto-saving on mount
  const isInitialLoadDone = useRef(false);
  // Ref for the timeout to allow debounce saving
  const saveTimeoutRef = useRef(null);

  const isScheduled = startTime && endTime;

  const isInvalidSchedule = Boolean(startTime && endTime && new Date(endTime) <= new Date(startTime));

  const warnings = useMemo(() => {
    const list = [];
    if (isInvalidSchedule) list.push('Waktu batas akses lebih dulu atau sama dengan waktu mulai.');
    if (selectedClasses.length === 0) list.push('Belum ada kelas yang dipilih, ujian tidak akan terlihat oleh siswa.');
    if (requireToken && tokenType === 'static' && !currentToken.trim()) list.push('Token statis belum diisi, siswa tidak akan bisa memulai ujian.');
    if (requireToken && tokenType === 'auto' && !liveAutoToken) list.push('Token otomatis belum tersedia dari server.');
    if (requireAllAnswered && minTimeMinutes > 0) list.push('Wajib jawab semua soal + batas pengumpulan bisa membuat siswa gagal submit.');
    const safers = [requireSafeBrowser && 'Rushless Safer', requireSeb && 'SEB', requireGeschool && 'Geschool'].filter(Boolean);
    if (safers.length > 1) list.push(`Lebih dari satu aplikasi pengawas aktif (${safers.join(', ')}). Pilih salah satu.`);
    return list;
  }, [isInvalidSchedule, selectedClasses.length, requireToken, tokenType, currentToken, liveAutoToken, requireAllAnswered, minTimeMinutes, requireSafeBrowser, requireSeb, requireGeschool]);

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
      setRequireGeschool(!!data.require_geschool);
      setShowInstructions(!!data.show_instructions);
      setInstructionType(data.instruction_type || 'template');
      setCustomInstructions(data.custom_instructions || '');
      setShowResult(!!data.show_result);
      setShowAnalysis(!!data.show_analysis);
      setRequireAllAnswered(!!data.require_all_answered);
      setRequireToken(!!data.require_token);
      setTokenType(data.token_type || 'static');
      setCurrentToken(data.current_token || '');
      setViolationAction(data.violation_action || 'abaikan');
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

  // Live Auto-Token Poller
  useEffect(() => {
    if (!requireToken || tokenType !== 'auto' || !examId) {
      setLiveAutoToken('');
      return;
    }
    
    const fetchAutoToken = async () => {
      try {
        const res = await fetch(`/api/exams/auto-token?examId=${examId}`);
        if (res.ok) {
           const data = await res.json();
           setLiveAutoToken(data.auto_token);
        }
      } catch (err) {
        console.error("Failed to fetch auto token", err);
      }
    };

    fetchAutoToken();
    // Poll every 10 seconds to ensure it flips right at the 15-minute mark
    const interval = setInterval(fetchAutoToken, 10000);
    return () => clearInterval(interval);
  }, [requireToken, tokenType, examId]);

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
    setSaveState('saving');
    const savingToastId = toast.loading('Menyimpan perubahan...');

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
        startTime: datetimeLocalToMysql(startTime),
        endTime: datetimeLocalToMysql(endTime),
        shuffleQuestions: shuffleQuestions,
        shuffleAnswers: shuffleAnswers,
        timerMode: timerMode,
        durationMinutes: Number(durationMinutes) || 0,
        minTimeMinutes: Number(minTimeMinutes) || 0,
        maxAttempts: Number(maxAttempts) || 1,
        requireSafeBrowser: requireSafeBrowser,
        requireSeb: requireSeb,
        requireGeschool: requireGeschool,
        showInstructions: showInstructions,
        instructionType: instructionType,
        customInstructions: customInstructions,
        showResult: showResult,
        showAnalysis: showAnalysis,
        requireAllAnswered: requireAllAnswered,
        requireToken: requireToken,
        tokenType: tokenType,
        currentToken: currentToken,
        violationAction: violationAction,
        allowedClasses: selectedClasses
      }),
    });

    try {
      const [detailsRes, settingsRes] = await Promise.all([examDetailsPromise, examSettingsPromise]);

      if (!detailsRes.ok || !settingsRes.ok) {
        const detailsData = !detailsRes.ok ? await detailsRes.json() : null;
        const settingsData = !settingsRes.ok ? await settingsRes.json() : null;
        const errorMessage = (detailsData?.message || '') + ' ' + (settingsData?.message || '');
        throw new Error(errorMessage.trim() || 'Terjadi kesalahan saat menyimpan.');
      }

      toast.success('Semua perubahan berhasil disimpan.', { id: savingToastId });
      setSaveState('saved');
    } catch (err) {
      toast.error(err.message, { id: savingToastId });
      setSaveState('error');
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
    timerMode, durationMinutes, minTimeMinutes, maxAttempts, requireSafeBrowser, requireSeb, requireGeschool, selectedClasses, showInstructions, instructionType, customInstructions, showResult, showAnalysis, requireAllAnswered, requireToken, tokenType, currentToken, violationAction
  ]);

if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-7 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-10 w-2/3 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-10 w-2/3 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 h-40 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/dashboard/exams"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={14} />
            Kembali ke Daftar Ujian
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5 break-words">
            {examName || 'Kelola Ujian'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Semua perubahan tersimpan otomatis 1 detik setelah kamu berhenti mengetik.
          </p>
        </div>

        <SaveIndicator state={saveState} saving={saving} />
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">Perlu diperhatikan</p>
          <ul className="space-y-1">
            {warnings.map(w => (
              <li key={w} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigasi section */}
      <nav className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-slate-50 dark:bg-slate-950/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-1.5 overflow-x-auto">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Kolom utama */}
        <div className="lg:col-span-2 space-y-4">
          {/* Detail Ujian */}
          <Section
            id="detail"
            title="Detail Ujian"
            description="Nama, deskripsi, dan mata pelajaran untuk ujian ini."
            open={openSections.detail}
            onToggle={() => setOpenSections(p => ({ ...p, detail: !p.detail }))}
          >
            <Field label="Nama Ujian" htmlFor="examName" hint="Ditampilkan ke siswa saat membuka daftar ujian.">
              <input
                id="examName"
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="Contoh: Ujian Tengah Semester"
                className={inputCls}
                required
              />
            </Field>

            <Field label="Deskripsi" htmlFor="description" hint="Penjelasan singkat mengenai materi atau lingkup ujian.">
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opsional"
                rows={4}
                className={inputCls}
              />
            </Field>

            <Field label="Mata Pelajaran" htmlFor="subjectId" hint="Membantu mengelompokkan ujian di daftar siswa.">
              <select id="subjectId" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>
                <option value="">Pilih Mata Pelajaran...</option>
                {availableSubjects.map((sbj) => (
                  <option key={sbj.id} value={sbj.id}>{sbj.name}</option>
                ))}
              </select>
            </Field>
          </Section>

          {/* Jadwal & Waktu */}
          <Section
            id="jadwal"
            title="Jadwal & Waktu Pengerjaan"
            description="Tentukan kapan ujian bisa diakses dan berapa lama siswa boleh mengerjakan."
            open={openSections.jadwal}
            onToggle={() => setOpenSections(p => ({ ...p, jadwal: !p.jadwal }))}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Waktu Mulai Akses" htmlFor="startTime" hint={`Kosongkan jika ujian bisa diakses kapan saja. Jam diisi sesuai zona waktu aplikasi (${timezone}).`}>
                <input id="startTime" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Waktu Batas Akses" htmlFor="endTime" hint={`Siswa tidak bisa masuk atau melanjutkan setelah waktu ini (${timezone}).`}>
                <input id="endTime" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
              </Field>
            </div>

            {(startTime || endTime) && (
              <InlineNote tone="info">
                <Clock size={13} className="inline mr-1 -mt-0.5" />
                Akan dibaca sebagai: <strong>{fmt.dateTime(`${startTime || endTime}`.replace('T', ' '))}</strong>
                <span className="opacity-70"> ({timezone})</span>
              </InlineNote>
            )}

            {!isScheduled && (
              <InlineNote tone="info">
                Jadwal belum diisi. Ujian bisa diakses siswa kapan saja, dan hanya metode <strong>Mandiri (Asinkron)</strong> yang tersedia.
              </InlineNote>
            )}
            {isInvalidSchedule && (
              <InlineNote tone="warning">
                Waktu batas akses lebih dulu dari waktu mulai. Periksa kembali tanggal dan jamnya.
              </InlineNote>
            )}

            <Field label="Metode Waktu" hint={timerMode === 'sync'
              ? 'Semua siswa memakai waktu mulai dan selesai yang sama, mengikuti jadwal.'
              : 'Setiap siswa mendapat durasi tetap sejak menekan tombol Mulai. Jadwal hanya menjadi jendela akses.'}>
              <SegmentedControl
                name="timer-mode"
                options={[
                  { label: 'Serentak (Sinkron)', value: 'sync', disabled: !isScheduled },
                  { label: 'Mandiri (Asinkron)', value: 'async' },
                ]}
                value={timerMode}
                onChange={setTimerMode}
              />
              {!isScheduled && (
                <p className="text-[11px] text-slate-400 mt-1.5">Serentak tidak tersedia karena jadwal belum diisi.</p>
              )}
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(timerMode === 'async' || !isScheduled) && (
                <Field label="Durasi Ujian" htmlFor="duration" hint="Dalam menit.">
                  <input
                    id="duration"
                    type="number"
                    min="1"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className={inputCls}
                  />
                </Field>
              )}
              <Field label="Batas Pengumpulan" htmlFor="minTime" hint="Menit terakhir yang ditutup submit. Isi 0 untuk menonaktifkan.">
                <input
                  id="minTime"
                  type="number"
                  min="0"
                  value={minTimeMinutes}
                  onChange={(e) => setMinTimeMinutes(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className={inputCls}
                />
              </Field>
              <Field label="Maksimal Percobaan" htmlFor="maxAttempts" hint="Berapa kali siswa boleh mengulang.">
                <input
                  id="maxAttempts"
                  type="number"
                  min="1"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          {/* Kelas */}
          <Section
            id="kelas"
            title="Kelas yang Berparticipan"
            description="Hanya siswa dari kelas terpilih yang melihat ujian ini."
            open={openSections.kelas}
            onToggle={() => setOpenSections(p => ({ ...p, kelas: !p.kelas }))}
            badge={selectedClasses.length > 0 ? `${selectedClasses.length} kelas` : null}
          >
            {availableClasses.length === 0 ? (
              <InlineNote tone="warning">Belum ada data kelas. Buat kelas terlebih dahulu di menu Kelas.</InlineNote>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableClasses.map((cls) => {
                  const isSelected = selectedClasses.includes(cls.id);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => handleToggleClass(cls.id)}
                      aria-pressed={isSelected}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${isSelected
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {isSelected ? <Check size={14} /> : <Plus size={14} className="text-slate-400" />}
                      {cls.class_name}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedClasses.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedClasses.length} kelas dipilih.</p>
                <button
                  type="button"
                  onClick={() => setSelectedClasses([])}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  Kosongkan pilihan
                </button>
              </div>
            )}
          </Section>

          {/* Keamanan */}
          <Section
            id="keamanan"
            title="Keamanan & Fair Play"
            description="Aplikasi pengawas, pengacakan soal, dan tindakan saat pelanggaran."
            open={openSections.keamanan}
            onToggle={() => setOpenSections(p => ({ ...p, keamanan: !p.keamanan }))}
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <Switch
                id="req-safe-browser"
                label="Gunakan Rushless Safer"
                description="Siswa wajib memakai aplikasi Rushless Safer saat mengerjakan ujian."
                checked={requireSafeBrowser}
                onChange={() => setRequireSafeBrowser(!requireSafeBrowser)}
              />
              <Switch
                id="req-seb"
                label="Gunakan SEB (Safe Exam Browser)"
                description="Siswa wajib memakai aplikasi Safe Exam Browser."
                checked={requireSeb}
                onChange={() => setRequireSeb(!requireSeb)}
              />
              <Switch
                id="req-geschool"
                label="Gunakan Geschool Secure Mode"
                description="Siswa wajib memakai aplikasi Geschool Secure Mode."
                checked={requireGeschool}
                onChange={() => setRequireGeschool(!requireGeschool)}
              />
            </div>

            {requireGeschool && (
              <InlineNote tone="info" title="Info Sandi Emergency">
                Sandi Emergency Exit mengikuti <strong>Konfigurasi Keamanan Aplikasi</strong> (Android &amp; Safer) pada menu Admin Tools. Perubahan di sana otomatis berlaku untuk semua ujian dengan mode ini.
              </InlineNote>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <Switch
                id="shuffle-questions"
                label="Acak Urutan Soal"
                description="Setiap siswa mendapat urutan soal yang berbeda."
                checked={shuffleQuestions}
                onChange={() => setShuffleQuestions(!shuffleQuestions)}
              />
              <Switch
                id="shuffle-answers"
                label="Acak Urutan Jawaban"
                description="Opsi jawaban pada soal pilihan ganda diacak."
                checked={shuffleAnswers}
                onChange={() => setShuffleAnswers(!shuffleAnswers)}
              />
              <Switch
                id="require-all-answered"
                label="Wajib Jawab Semua Soal"
                description="Siswa tidak bisa mengumpulkan jawaban selama masih ada soal kosong."
                checked={requireAllAnswered}
                onChange={() => setRequireAllAnswered(!requireAllAnswered)}
              />
            </div>

            <Field
              label="Tindakan Pelanggaran Layar"
              hint={violationAction === 'abaikan'
                ? 'Abaikan: hanya tercatat di log keamanan.'
                : violationAction === 'peringatan'
                  ? 'Peringatan: siswa diberi pesan peringatan saat kembali ke halaman ujian.'
                  : 'Kunci Ujian: ujian terkunci otomatis hingga dibuka pengawas di kontrol ujian.'}
            >
              <SegmentedControl
                name="violation-action"
                options={[
                  { label: 'Abaikan', value: 'abaikan' },
                  { label: 'Peringatan', value: 'peringatan' },
                  { label: 'Kunci Ujian', value: 'kunci' },
                ]}
                value={violationAction}
                onChange={setViolationAction}
              />
            </Field>
          </Section>

          {/* Token */}
          <Section
            id="token"
            title="Token Akses"
            description="Siswa harus memasukkan token sebelum memulai ujian."
            open={openSections.token}
            onToggle={() => setOpenSections(p => ({ ...p, token: !p.token }))}
            badge={requireToken ? 'Aktif' : null}
          >
            <Switch
              id="require-token"
              label="Perlu Token untuk Mulai Ujian"
              description="Siswa harus memasukkan 6-digit token sebelum bisa memulai ujian."
              checked={requireToken}
              onChange={() => setRequireToken(!requireToken)}
              standalone
            />

            {!requireToken && (
              <p className="text-xs text-slate-400">Tanpa token, siswa cukup menekan tombol Mulai Ujian untuk memulai.</p>
            )}

            {requireToken && (
              <div className="space-y-3 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                <SegmentedControl
                  name="token-type"
                  options={[
                    { value: 'static', label: 'Statis (Custom)' },
                    { value: 'auto', label: 'Otomatis (Tiap 15 Menit)' }
                  ]}
                  value={tokenType}
                  onChange={(val) => {
                    setTokenType(val);
                    if (val === 'auto') setCurrentToken('');
                  }}
                />

                {tokenType === 'static' ? (
                  <Field label="Token Ujian" htmlFor="staticToken" hint="Maksimal 6 karakter. Siswa harus mengetik persis sama.">
                    <input
                      id="staticToken"
                      type="text"
                      maxLength={6}
                      value={currentToken}
                      onChange={(e) => setCurrentToken(e.target.value.toUpperCase())}
                      placeholder="Contoh: ABCD12"
                      className={`${inputCls} font-mono uppercase tracking-widest`}
                    />
                  </Field>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Token aktif saat ini</p>
                    <p className="text-3xl font-mono font-bold tracking-[0.3em] text-slate-900 dark:text-white mt-1.5">
                      {liveAutoToken || '••••••'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      Di-generate server dan <strong>berubah otomatis setiap 15 menit</strong>. Diperbarui otomatis di layar ini.
                    </p>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Petunjuk */}
          <Section
            id="petunjuk"
            title="Petunjuk Pengerjaan"
            description="Halaman petunjuk yang muncul sebelum siswa memulai ujian."
            open={openSections.petunjuk}
            onToggle={() => setOpenSections(p => ({ ...p, petunjuk: !p.petunjuk }))}
          >
            <Switch
              id="show-instructions"
              label="Tampilkan Petunjuk Pengerjaan"
              description="Petunjuk muncul sebelum tombol Mulai Ujian ditekan."
              checked={showInstructions}
              onChange={() => setShowInstructions(!showInstructions)}
              standalone
            />

            {showInstructions && (
              <div className="space-y-3 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                <SegmentedControl
                  name="instruction-type"
                  options={[
                    { label: 'Template Default', value: 'template' },
                    { label: 'Teks Kustom', value: 'custom' },
                  ]}
                  value={instructionType}
                  onChange={setInstructionType}
                />

                {instructionType === 'template' ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Preview Petunjuk Default</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li>Berdoalah sebelum mengerjakan ujian.</li>
                      <li>Periksa daftar soal untuk melihat ragam pertanyaan yang tersedia.</li>
                      <li>Silakan gunakan fitur <strong>Tandai Ragu</strong> jika belum yakin dengan jawaban.</li>
                      <li>Kerjakan dengan jujur dan teliti.</li>
                      <li>Pastikan menekan <strong>Selesai Ujian</strong> sebelum waktu habis.</li>
                    </ul>
                  </div>
                ) : (
                  <Field label="Teks Petunjuk Kustom" htmlFor="customInstructions" hint="Mendukung formatasi teks (bold, daftar, dan lainnya).">
                    <div className="border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
                      <JoditEditor
                        value={customInstructions}
                        onBlur={newContent => setCustomInstructions(newContent)}
                        config={{
                          readonly: false,
                          theme: 'default',
                          hidePoweredByJodit: true,
                          placeholder: 'Ketik petunjuk kustom di sini...',
                        }}
                      />
                    </div>
                  </Field>
                )}
              </div>
            )}
          </Section>

          {/* Hasil */}
          <Section
            id="hasil"
            title="Hasil & Analisis"
            description="Apa yang boleh dilihat siswa setelah ujian selesai."
            open={openSections.hasil}
            onToggle={() => setOpenSections(p => ({ ...p, hasil: !p.hasil }))}
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <Switch
                id="show-result"
                label="Tampilkan Hasil"
                description="Siswa dapat melihat skor akhir setelah ujian selesai."
                checked={showResult}
                onChange={() => {
                  const val = !showResult;
                  setShowResult(val);
                  if (!val) setShowAnalysis(false);
                }}
                standalone
              />
              {showResult && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40">
                  <Switch
                    id="show-analysis"
                    label="Tampilkan Analisis Jawaban"
                    description="Siswa melihat soal mana yang benar/salah beserta kunci jawabannya."
                    checked={showAnalysis}
                    onChange={() => setShowAnalysis(!showAnalysis)}
                  />
                </div>
              )}
            </div>
            {!showResult && (
              <p className="text-xs text-slate-400">Siswa tidak melihat apa pun setelah ujian selesai; hasil hanya tersedia untuk pengawas.</p>
            )}
          </Section>
        </div>

        {/* Kolom samping */}
        <div className="lg:col-span-1">
          <div className="space-y-4 lg:sticky lg:top-14">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Ringkasan</h3>
              <dl className="mt-3 space-y-2.5 text-sm">
                <SummaryRow label="Jadwal" value={isScheduled ? 'Terjadwal' : 'Tanpa jadwal'} tone={isScheduled ? 'emerald' : 'amber'} />
                <SummaryRow
                  label="Metode waktu"
                  value={timerMode === 'sync' ? 'Serentak' : 'Mandiri'}
                />
                <SummaryRow
                  label="Durasi"
                  value={timerMode === 'sync' ? 'Mengikuti jadwal' : `${durationMinutes || 0} menit`}
                />
                <SummaryRow label="Kelas" value={selectedClasses.length > 0 ? `${selectedClasses.length} dipilih` : 'Belum ada'} tone={selectedClasses.length > 0 ? 'default' : 'amber'} />
                <SummaryRow label="Token" value={requireToken ? (tokenType === 'auto' ? 'Otomatis' : currentToken || 'Belum diisi') : 'Tanpa token'} tone={requireToken && tokenType === 'static' && !currentToken ? 'amber' : 'default'} />
                <SummaryRow label="Acak soal" value={shuffleQuestions ? 'Aktif' : 'Nonaktif'} />
                <SummaryRow label="Tindakan pelanggaran" value={{ abaikan: 'Abaikan', peringatan: 'Peringatan', kunci: 'Kunci Ujian' }[violationAction] || violationAction} />
                <SummaryRow label="Hasil untuk siswa" value={showResult ? (showAnalysis ? 'Skor + analisis' : 'Skor saja') : 'Tidak ditampilkan'} />
              </dl>
            </div>

            <Link
              href={`/dashboard/exams/questions/${examId}`}
              className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <ClipboardList size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Kelola Soal</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tambah, edit, atau import soal ujian ini.</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600 mt-1" />
              </div>
            </Link>

            <Link
              href={`/dashboard/exams/results/${examId}`}
              className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <BarChart3Icon />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Hasil Ujian</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Lihat skor, analisis jawaban, dan ekspor data.</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600 mt-1" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors';

const SECTIONS = [
  { id: 'detail', label: 'Detail' },
  { id: 'jadwal', label: 'Jadwal & Waktu' },
  { id: 'kelas', label: 'Kelas' },
  { id: 'keamanan', label: 'Keamanan' },
  { id: 'token', label: 'Token' },
  { id: 'petunjuk', label: 'Petunjuk' },
  { id: 'hasil', label: 'Hasil' }
];

function Section({ id, title, description, children, open, onToggle, badge }) {
  return (
    <section id={id} className="scroll-mt-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{title}</span>
          {description && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>}
        </span>
        {badge && (
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{badge}</span>
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-4">{children}</div>}
    </section>
  );
}

function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{hint}</p>}
    </div>
  );
}

function InlineNote({ tone = 'info', title, children }) {
  const toneCls = tone === 'warning'
    ? 'border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300';
  return (
    <div className={`rounded-lg border px-3.5 py-3 ${toneCls}`}>
      {title && <p className="text-xs font-bold mb-1">{title}</p>}
      <p className="text-xs leading-relaxed">{children}</p>
    </div>
  );
}

function SummaryRow({ label, value, tone = 'default' }) {
  const toneCls = tone === 'emerald'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'amber'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-slate-700 dark:text-slate-200';
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`text-xs font-semibold text-right ${toneCls}`}>{value}</dd>
    </div>
  );
}

function SaveIndicator({ state, saving }) {
  const map = {
    saving: { text: 'Menyimpan...', cls: 'text-slate-500 dark:text-slate-400', icon: <span className="w-3 h-3 border-2 border-slate-300 dark:border-slate-600 border-t-slate-600 dark:border-t-slate-300 rounded-full animate-spin" /> },
    saved: { text: 'Semua perubahan tersimpan', cls: 'text-emerald-600 dark:text-emerald-400', icon: <CheckCircle2 size={14} /> },
    error: { text: 'Gagal menyimpan', cls: 'text-red-600 dark:text-red-400', icon: <AlertCircle size={14} /> },
    idle: { text: 'Perubahan tersimpan otomatis', cls: 'text-slate-400 dark:text-slate-500', icon: <Info size={14} /> }
  };
  const item = map[state] || map.idle;
  return (
    <div className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold ${item.cls}`}>
      {saving ? map.saving.icon : item.icon}
      {saving ? map.saving.text : item.text}
    </div>
  );
}

function BarChart3Icon() {
  return (
    <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l3-4 3 3 5-6" />
    </svg>
  );
}
