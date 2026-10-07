'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/app/context/UserContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { wallClockToEpochMs } from '@/app/lib/timezone';
import { toast } from 'sonner';

// --- Icons ---
const Icons = {
  Plus: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  ChevronRight: (props) => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>,
  FileText: (props) => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Play: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ChartBar: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Cog: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Duplicate: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  Trash: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Folder: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  ChevronDown: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>,
  DotsVertical: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>,
  Eye: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  EyeOff: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>,
  Clock: (props) => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ArrowUp: (props) => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>,
  ArrowDown: (props) => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>,
  Grip: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" /></svg>,
  Shield: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Search: (props) => <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Archive: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 9v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9m16 0V7a2 2 0 00-2-2H4a2 2 0 00-2 2v2m18 0H2m8 4v4m-2-2h4" /></svg>,
  Unarchive: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 9v10a2 2 0 002 2h12a2 2 0 002-2V9m-16 0V7a2 2 0 012-2h12a2 2 0 012 2v2M4 9h16M9 14h6" /></svg>,
  Alert: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Close: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
  Check: (props) => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  Spinner: (props) => <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" {...props}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
};

// --- Design tokens ---
// Satu sumber warna untuk seluruh kartu ujian: aksen kiri card, warna chip
// schedule, dan tombol aksi semuanya diturunkan dari status yang sama, jadi
// kartu tidak terlihat flat dan warna selalu punya arti (bukan hiasan).
const STATUS_ACCENT = {
  notStarted: {
    bar: 'from-slate-400 to-slate-300 dark:from-slate-600 dark:to-slate-700',
    ring: 'ring-slate-200 dark:ring-slate-800',
    chip: 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    iconWrap: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  },
  inProgress: {
    bar: 'from-amber-400 to-orange-400 dark:from-amber-500 dark:to-orange-600',
    ring: 'ring-amber-200 dark:ring-amber-900/50',
    chip: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
    iconWrap: 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
  },
  available: {
    bar: 'from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600',
    ring: 'ring-emerald-200 dark:ring-emerald-900/50',
    chip: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60',
    iconWrap: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
  },
  ended: {
    bar: 'from-slate-300 to-slate-200 dark:from-slate-700 dark:to-slate-800',
    ring: 'ring-slate-200 dark:ring-slate-800',
    chip: 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    iconWrap: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
  },
};

/**
 * Status visual satu kartu, dipakai ExamCard (untuk warna) dan
 * StudentExamActions (untuk isi tombol) supaya keduanya tidak pernah
 * berbeda pendapat soal warna kartu.
 */
function getExamStatusKey(exam, timezone, now) {
  const startTime = wallClockToEpochMs(exam.start_time, timezone);
  const endTime = wallClockToEpochMs(exam.end_time, timezone);
  const maxAttempts = exam.max_attempts ? Number(exam.max_attempts) : null;
  const userAttempts = exam.user_attempts || 0;
  const maxReached = maxAttempts !== null && userAttempts >= maxAttempts;

  if (startTime !== null && now > 0 && now < startTime) return 'notStarted';
  if (exam.has_in_progress && !(endTime !== null && now > 0 && now > endTime)) return 'inProgress';
  if (maxReached || (endTime !== null && now > 0 && now > endTime)) return 'ended';
  return 'available';
}

// --- Student Action Button Component ---
const StudentExamActions = ({ exam, accent, nowMs }) => {
  const { t, timezone } = useLanguage();

  // Jadwal MySQL bersifat naive, jadi harus dikonversi ke epoch lewat zona
  // aplikasi. Kalau pakai new Date() langsung, hasilnya mengikuti zona browser
  // dan countdown bisa meleset beberapa jam.
  const startTime = wallClockToEpochMs(exam.start_time, timezone);
  const endTime = wallClockToEpochMs(exam.end_time, timezone);
  const maxAttempts = exam.max_attempts ? Number(exam.max_attempts) : null;
  const userAttempts = exam.user_attempts || 0;
  const hasInProgress = !!exam.has_in_progress;
  const latestAttemptId = exam.latest_attempt_id;
  const latestScore = exam.latest_score;

  // Jam lokal dikirim dari atas (satu interval untuk semua kartu, bukan satu
  // per kartu) supaya countdown benar-benar jalan tanpa boros timer.
  const now = nowMs ?? 0;

  // Determine exam window status
  const examNotStarted = startTime !== null && now > 0 && now < startTime;
  const examEnded = endTime !== null && now > 0 && now > endTime;
  const maxAttemptsReached = maxAttempts !== null && userAttempts >= maxAttempts;
  // Sebelum jam lokal diketahui, anggap belum selesai supaya tidak sempat
  // menampilkan tombol "Selesai" untuk ujian yang masih berjalan.
  const canTakeExam = now > 0 && !examNotStarted && !examEnded && !maxAttemptsReached;

  // Format countdown to start
  const formatCountdown = (targetMs) => {
    const diff = Math.max(0, targetMs - now);
    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (days > 0) return `${days}d ${hours}h ${t('exams_countdown_prefix')}`;
    if (hours > 0) return `${hours}h ${mins}m ${t('exams_countdown_prefix')}`;
    if (mins > 0) return `${mins}m ${secs}s ${t('exams_countdown_prefix')}`;
    return `${secs}s ${t('exams_countdown_prefix')}`;
  };

  // Badge status. Warna diambil dari palet status yang sama dengan aksen card,
  // jadi badge dan card selalu satu bahasa visual.
  let badge = null;
  if (examNotStarted) {
    badge = (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${accent.chip}`}>
        {t('exams_badge_not_started')}
      </span>
    );
  } else if (hasInProgress && !examEnded) {
    badge = (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${accent.chip}`}>
        {t('exams_badge_in_progress')}
      </span>
    );
  } else if (examEnded || maxAttemptsReached) {
    badge = (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${accent.chip}`}>
        {examEnded ? t('exams_badge_ended') : t('exams_badge_finished')}
      </span>
    );
  } else if (canTakeExam) {
    badge = (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${accent.chip}`}>
        {t('exams_badge_available')}
      </span>
    );
  }

  // Attempt counter label
  const attemptInfo = maxAttempts !== null ? (
    <span className="text-[11px] text-slate-400 dark:text-slate-500">
      {t('exams_attempt_count').replace('{current}', userAttempts).replace('{max}', maxAttempts)}
    </span>
  ) : userAttempts > 0 ? (
    <span className="text-[11px] text-slate-400 dark:text-slate-500">
      {t('exams_attempt_count_no_max').replace('{count}', userAttempts)}
    </span>
  ) : null;

  // Action button
  const [isLaunching, setIsLaunching] = useState(false);
  const [isAndroidApp, setIsAndroidApp] = useState(false);
  const [showMethods, setShowMethods] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      const isApp = userAgent.includes('rushlesssaferandroid') || !!window.RushlessSafer;
      setIsAndroidApp(isApp);
    }
  }, []);

  const handleLaunchApp = async (e) => {
    e.preventDefault();
    if (isLaunching) return;

    try {
      setIsLaunching(true);
      const res = await fetch('/api/auth/generate-token', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to generate handoff token');

      const targetUrl = window.location.origin + '/dashboard/exams/kerjakan/' + exam.id;
      const launchUrl = `rushless-safer://lock?url=${encodeURIComponent(targetUrl)}&handoff_token=${data.token}`;

      window.location.href = launchUrl;
    } catch (err) {
      console.error('Launch failed:', err);
      const targetUrl = window.location.origin + '/dashboard/exams/kerjakan/' + exam.id;
      window.location.href = `rushless-safer://lock?url=${encodeURIComponent(targetUrl)}`;
    } finally {
      setIsLaunching(false);
    }
  };

  const handleLaunchSEB = async (e) => {
    e.preventDefault();
    if (isLaunching) return;

    try {
      setIsLaunching(true);
      const res = await fetch('/api/auth/generate-token', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to generate SEB token');

      const protocol = window.location.protocol === 'https:' ? 'sebs://' : 'seb://';
      const host = window.location.host;
      const clientProtocol = window.location.protocol.replace(':', '');
      const clientHost = window.location.host;
      const launchUrl = `${protocol}${host}/api/exams/${exam.id}/seb-config?token=${data.token}&clientProtocol=${clientProtocol}&clientHost=${clientHost}`;
      
      window.location.href = launchUrl;
    } catch (err) {
      console.error('SEB Launch failed:', err);
      toast.error('Gagal meluncurkan Safe Exam Browser');
    } finally {
      setIsLaunching(false);
    }
  };

  const handleLaunchGeschool = async (e) => {
    e.preventDefault();
    if (isLaunching) return;

    try {
      setIsLaunching(true);
      const res = await fetch('/api/auth/generate-token', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to generate Geschool token');

      const targetUrl = window.location.origin + '/dashboard/exams/kerjakan/' + exam.id;
      const finalRedirectUrl = window.location.origin + `/api/auth/handoff?token=${data.token}&redirect=${encodeURIComponent(targetUrl)}`;
      const launchUrl = `geschool://open?url=${encodeURIComponent(finalRedirectUrl)}`;

      window.location.href = launchUrl;
    } catch (err) {
      console.error('Geschool Launch failed:', err);
      toast.error('Gagal meluncurkan Geschool Secure Mode');
    } finally {
      setIsLaunching(false);
    }
  };

  const enabledMethods = useMemo(() => {
    const methods = [];
    if (exam.require_safe_browser) {
      methods.push({ 
        id: 'safer', 
        label: 'Rushless Safer', 
        handler: handleLaunchApp, 
        icon: <Icons.Shield className="w-4 h-4" />,
        color: 'bg-indigo-600 hover:bg-indigo-700'
      });
    }
    if (exam.require_seb) {
      methods.push({ 
        id: 'seb', 
        label: 'Safe Exam Browser', 
        handler: handleLaunchSEB, 
        icon: <Icons.Shield className="w-4 h-4" />,
        color: 'bg-blue-600 hover:bg-blue-700'
      });
    }
    if (exam.require_geschool) {
      methods.push({ 
        id: 'geschool', 
        label: 'Geschool Secure Mode', 
        handler: handleLaunchGeschool, 
        icon: <Icons.Shield className="w-4 h-4" />,
        color: 'bg-emerald-600 hover:bg-emerald-700'
      });
    }
    return methods;
  }, [exam.require_safe_browser, exam.require_seb, exam.require_geschool, handleLaunchApp, handleLaunchSEB, handleLaunchGeschool]);

  const actions = [];
  const latestFinished = exam.latest_attempt_status === 'completed';
  const showResultsSetting = !!exam.show_result;

  if (examNotStarted) {
    actions.push(
      <div key="status" className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${accent.chip} select-none`}>
        <Icons.Clock className="w-4 h-4 shrink-0" />
        <span>{t('exams_status_not_started')} · {formatCountdown(startTime)}</span>
      </div>
    );
  } else if (hasInProgress && !examEnded) {
    const isSecure = (exam.require_safe_browser || exam.require_seb || exam.require_geschool) && !isAndroidApp;
    
    actions.push(
      <div key="in_progress" className="flex flex-col gap-2">
        {isSecure ? (
          showMethods && enabledMethods.length > 1 ? (
             <div className="flex flex-col gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 px-1">Pilih Aplikasi:</p>
                {enabledMethods.map(m => (
                  <button
                    key={m.id}
                    onClick={m.handler}
                    disabled={isLaunching}
                    className={`w-full flex items-center justify-between px-3 py-2.5 ${m.color} text-white rounded-lg text-xs font-bold transition-all shadow-sm ${isLaunching ? 'opacity-70 cursor-wait' : 'active:scale-[0.98]'}`}
                  >
                    <div className="flex items-center gap-2">
                      {m.icon}
                      <span>{isLaunching ? t('layout_loading') : m.label}</span>
                    </div>
                    <Icons.ChevronRight className="w-3 h-3" />
                  </button>
                ))}
                <button onClick={() => setShowMethods(false)} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-center mt-1 py-1 font-bold">Batal</button>
             </div>
          ) : (
            <button
              onClick={enabledMethods.length > 1 ? () => setShowMethods(true) : enabledMethods[0]?.handler}
              disabled={isLaunching}
              className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-amber-200/60 dark:shadow-amber-950/40 ${isLaunching ? 'opacity-70 cursor-wait' : ''}`}
            >
               <Icons.Play className="w-4 h-4" />
               <span>{isLaunching ? t('layout_loading') : enabledMethods.length > 1 ? 'Lanjutkan (Pilih Aplikasi)' : t('exams_action_continue')}</span>
            </button>
          )
        ) : (
          <Link
            href={`/dashboard/exams/kerjakan/${exam.id}`}
            className="group w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-amber-200/60 dark:shadow-amber-950/40"
          >
            <Icons.Play className="w-4 h-4" />
            <span>{t('exams_action_continue')}</span>
            <Icons.ChevronRight className="w-3 h-3 opacity-70 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    );
  } else {
    // 1. Show Results if configured and we have at least one attempt ID
    if (latestAttemptId && latestFinished) {
      if (showResultsSetting) {
        actions.push(
          <Link
            key="results"
            href={`/dashboard/exams/hasil/${latestAttemptId}`}
            className="group w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-200/60 dark:shadow-indigo-950/40"
          >
            <Icons.ChartBar className="w-4 h-4" />
            <span>{t('exams_btn_results')} {latestScore !== null && latestScore !== undefined ? `(${Number(latestScore) % 1 === 0 ? latestScore : Number(latestScore).toFixed(2)})` : ''}</span>
            <Icons.ChevronRight className="w-3 h-3 opacity-70 transition-transform group-hover:translate-x-0.5" />
          </Link>
        );
      } else if (examEnded || maxAttemptsReached) {
        actions.push(
          <div key="results_hidden" className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 select-none">
            <Icons.Shield className="w-4 h-4" />
            <span>{t('exams_status_hidden')}</span>
          </div>
        );
      }
    }

    // 2. Show "Take/Repeat" if available
    if (canTakeExam) {
      const isSecure = (exam.require_safe_browser || exam.require_seb || exam.require_geschool) && !isAndroidApp;
      const btnLabel = userAttempts > 0 ? t('exams_action_repeat') : t('exams_action_start');

      actions.push(
        <div key="take" className="flex flex-col gap-2 mt-1">
          {isSecure ? (
             showMethods && enabledMethods.length > 1 ? (
                <div className="flex flex-col gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 px-1">Pilih Aplikasi:</p>
                   {enabledMethods.map(m => (
                     <button
                       key={m.id}
                       onClick={m.handler}
                       disabled={isLaunching}
                       className={`w-full flex items-center justify-between px-3 py-2.5 ${m.color} text-white rounded-lg text-xs font-bold transition-all shadow-sm ${isLaunching ? 'opacity-70 cursor-wait' : 'active:scale-[0.98]'}`}
                     >
                       <div className="flex items-center gap-2">
                         {m.icon}
                         <span>{isLaunching ? t('layout_loading') : m.label}</span>
                       </div>
                       <Icons.ChevronRight className="w-3 h-3" />
                     </button>
                   ))}
                   <button onClick={() => setShowMethods(false)} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-center mt-1 py-1 font-bold">Batal</button>
                </div>
             ) : (
              <button
                onClick={enabledMethods.length > 1 ? () => setShowMethods(true) : enabledMethods[0]?.handler}
                disabled={isLaunching}
                className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-200/60 dark:shadow-emerald-950/40 ${isLaunching ? 'opacity-70 cursor-wait' : ''}`}
              >
                 <Icons.Play className="w-4 h-4" />
                 <span>{isLaunching ? t('layout_loading') : enabledMethods.length > 1 ? (userAttempts > 0 ? 'Ulangi (Pilih Aplikasi)' : 'Mulai (Pilih Aplikasi)') : btnLabel}</span>
              </button>
             )
          ) : (
            <Link
              href={`/dashboard/exams/kerjakan/${exam.id}`}
              className="group w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-200/60 dark:shadow-emerald-950/40"
            >
              <Icons.Play className="w-4 h-4" />
              <span>{btnLabel}</span>
              <Icons.ChevronRight className="w-3 h-3 opacity-70 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      );
    } else if (examEnded && !latestAttemptId) {
      actions.push(
        <div key="ended" className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border ${accent.chip} select-none`}>
          <Icons.Clock className="w-4 h-4" />
          <span>{t('exams_badge_ended')}</span>
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        {badge}
        {attemptInfo}
      </div>
      <div className="space-y-2">
        {actions}
      </div>
    </div>
  );
};

// --- Exam Card Component ---
const ExamCard = ({ exam, isStudent, formatDate, fmt, openModal, categories, onToggleVisibility, onToggleArchive, nowMs }) => {
    const { t, timezone } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isArchived = !!exam.is_archived;

  // Kartu siswa mengikuti status|jadwal, kartu admin/guru tidak (keduanya cuma
  // soal konfigurasi), jadi admin tetap dapat palet emerald yang netral.
  const accent = isStudent
    ? STATUS_ACCENT[getExamStatusKey(exam, timezone, nowMs ?? 0)]
    : STATUS_ACCENT.available;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div className={`group relative flex flex-col rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden ring-1 ${accent.ring} transition-all duration-200 ${
      isArchived
        ? 'opacity-75 hover:opacity-90'
        : 'hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-slate-950/50 hover:-translate-y-0.5'
    } ${isArchived ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
      {/* Aksen status: garis gradien tipis di atas card. Warna = status, jadi
         _admin bisa sekilas tahu ujian mana yang aktif tanpa membaca teks. */}
      <div className={`h-1 w-full bg-gradient-to-r ${accent.bar}`} aria-hidden="true" />

      {/* Body */}
      <div className="p-4 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {isArchived && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
              <Icons.Archive className="w-3 h-3" /> Diarsipkan
            </span>
          )}
          {!isArchived && exam.exam_is_hidden && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
              {t('exams_status_hidden')}
            </span>
          )}
          {exam.subject_name && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
              {exam.subject_name}
            </span>
          )}
          {(exam.require_safe_browser || exam.require_seb || exam.require_geschool) && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold"
              title={[
                exam.require_safe_browser && 'Rushless Safer',
                exam.require_seb && 'SEB',
                exam.require_geschool && 'Geschool'
              ].filter(Boolean).join(', ')}
            >
              <Icons.Shield className="w-3 h-3" /> Mode Aman
            </span>
          )}
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white break-words" title={exam.exam_name}>
            {exam.exam_name}
          </h3>
          {exam.description && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{exam.description}</p>
          )}
        </div>

        {(exam.start_time || exam.end_time) && (
          <div className={`rounded-xl border px-3 py-2.5 space-y-1.5 ${accent.chip}`}>
            <p className="text-[10px] uppercase tracking-wide font-bold opacity-70">Jadwal</p>
            {exam.start_time && (
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Icons.Clock className="w-3 h-3 shrink-0 opacity-70" />
                <span className="opacity-70 font-normal">Mulai</span>
                <span className="ml-auto tabular-nums font-bold">{fmt.dateTime(exam.start_time)}</span>
              </p>
            )}
            {exam.end_time && (
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Icons.Clock className="w-3 h-3 shrink-0 opacity-70" />
                <span className="opacity-70 font-normal">Selesai</span>
                <span className="ml-auto tabular-nums font-bold">{fmt.dateTime(exam.end_time)}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-slate-800 px-3 py-3 bg-slate-50/70 dark:bg-slate-800/40">
        {isStudent ? (
          <StudentExamActions exam={exam} accent={accent} nowMs={nowMs} />
        ) : (
          <div className="flex items-center gap-1.5">
            <Link
              href={`/dashboard/exams/manage/${exam.id}`}
              title={t('exams_btn_manage')}
              aria-label={t('exams_btn_manage')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-300 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-900/40 transition-colors"
            >
              <Icons.Cog className="w-4 h-4" />
              {t('exams_btn_manage')}
            </Link>
            <Link
              href={`/dashboard/exams/results/${exam.id}`}
              title={t('exams_btn_results')}
              aria-label={t('exams_btn_results')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg border border-violet-200 dark:border-violet-900/60 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-300 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/40 transition-colors"
            >
              <Icons.ChartBar className="w-4 h-4" />
              {t('exams_btn_results')}
            </Link>

            <div className="relative flex-1" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label={t('exams_btn_others')}
                title={t('exams_btn_others')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white text-slate-600 hover:bg-slate-100 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                <Icons.DotsVertical className="w-4 h-4" />
                Lainnya
              </button>

              <div className={`absolute bottom-full right-0 mb-2 w-56 max-h-[60vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 transition-all origin-bottom-right z-30 ${isMenuOpen ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-95'}`}>
                <div className="p-1">
                  <button
                    onClick={() => {
                      openModal('duplicate', exam.id);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
                  >
                    <Icons.Duplicate className="w-4 h-4" />
                    <span>{t('exams_btn_duplicate')}</span>
                  </button>

                  {onToggleArchive && (
                    <button
                      onClick={() => {
                        onToggleArchive();
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
                    >
                      {isArchived ? <Icons.Unarchive className="w-4 h-4" /> : <Icons.Archive className="w-4 h-4" />}
                      <span>{isArchived ? 'Pulihkan dari Arsip' : 'Arsipkan Ujian'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (onToggleVisibility) onToggleVisibility();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
                  >
                    {exam.exam_is_hidden ? <Icons.Eye className="w-4 h-4" /> : <Icons.EyeOff className="w-4 h-4" />}
                    <span>{exam.exam_is_hidden ? t('exams_btn_show') : t('exams_btn_hide')}</span>
                  </button>

                  <button
                    onClick={() => {
                      openModal('moveExam', exam.id, exam.category_id || '');
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
                  >
                    <Icons.Folder className="w-4 h-4" />
                    <span>{t('exams_btn_move_category')}</span>
                  </button>

                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-1 mx-2" />

                  <button
                    onClick={() => {
                      openModal('delete', exam.id);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
                  >
                    <Icons.Trash className="w-4 h-4" />
                    <span>{t('exams_btn_delete_exam')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Category Accordion Component ---
const CategoryAccordion = ({ id, name, exams, isOpen, toggleOpen, isStudent, formatDate, fmt, openModal, categories, onEdit, onDelete, onToggleVisibility, isHidden, isAdminHidden, onToggleExamVisibility, onToggleExamArchive, onToggleArchive, onOpenManage, isArchived, userRole, userId, categoryCreatedBy, onMove, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, nowMs }) => {
  const { t } = useLanguage();

  // Hide empty categories for students, and hide empty 'Tanpa Nama' if categories exist
  if (isStudent && exams.length === 0) return null;
  if (id === 'uncategorized' && exams.length === 0 && categories.length > 0) return null;

  const canReorder = !isStudent && (userRole === 'admin' || userId === categoryCreatedBy);
  const canManage = id !== 'uncategorized' && !isStudent && (userRole === 'admin' || userId === categoryCreatedBy);

  // Ringkasan status kategori untuk ditampilkan di header
  const visibilitySummary = isArchived
    ? 'Diarsipkan - tidak muncul di daftar utama dan tidak terlihat siswa.'
    : isAdminHidden
      ? 'Disembunyikan untuk semua orang (guru & siswa).'
      : isHidden
        ? 'Disembunyikan dari siswa, guru masih bisa melihat.'
        : 'Terlihat oleh siswa.';



  return (
    <div
      className={`relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-shadow ${isOpen ? 'overflow-visible shadow-md shadow-slate-200/50 dark:shadow-slate-950/40' : 'overflow-hidden'} ${isDragging ? 'opacity-40 border-dashed border-slate-400' : ''} ${isArchived ? 'bg-slate-50/60 dark:bg-slate-900/60' : ''}`}
      draggable={canReorder}
      onDragStart={(e) => canReorder && onDragStart && onDragStart(e, id)}
      onDragOver={(e) => canReorder && onDragOver && onDragOver(e, id)}
      onDrop={(e) => canReorder && onDrop && onDrop(e, id)}
      onDragEnd={onDragEnd}
    >
      {/* Accordion Header */}
      <div
        className={`w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3.5 cursor-pointer select-none transition-colors ${isOpen
          ? 'bg-slate-50/80 dark:bg-slate-800/40'
          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
        }`}
        onClick={toggleOpen}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {canReorder && id !== 'uncategorized' && (
            <span className="shrink-0 text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing" title="Tahan dan tarik untuk mengubah urutan">
              <Icons.Grip className="w-4 h-4" />
            </span>
          )}

          {/* Chevron diletakkan di dalam kotak berwarna supaya header terasa
              punya "bentuk", bukan cuma baris teks. */}
          <span className={`shrink-0 grid place-items-center w-7 h-7 rounded-lg border transition-all duration-200 ${
            isOpen
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-300/50 dark:shadow-indigo-950/50'
              : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500'
          }`}>
            <Icons.ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={`text-sm font-bold break-words transition-colors ${isOpen ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>{name}</h2>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums border transition-colors ${
                isOpen
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/60 dark:text-indigo-300'
                  : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}>
                {exams.length} ujian
              </span>
              {!isStudent && !!isArchived && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                  <Icons.Archive className="w-3 h-3" /> Diarsipkan
                </span>
              )}
              {id !== 'uncategorized' && !isStudent && !!isAdminHidden && (
                <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[11px] font-semibold">
                  {t('exams_badge_admin_hidden')}
                </span>
              )}
              {id !== 'uncategorized' && !isStudent && !!isHidden && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                  {t('exams_badge_student_hidden')}
                </span>
              )}
            </div>
            {!isStudent && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{visibilitySummary}</p>
            )}
          </div>
        </div>

{/* Category Actions */}
        {canManage && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenManage && onOpenManage(); }}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white text-slate-600 hover:bg-slate-100 hover:border-slate-400 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition-colors"
          >
            <Icons.Cog className="w-3.5 h-3.5" />
            Kelola
          </button>
        )}
      </div>

      {/* Accordion Body */}
      <div className={`grid transition-all duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        {/* overflow disembunyikan saat tertutup (untuk animasi), tetapi dibuka saat
            accordion aktif supaya dropdown tidak terpotong */}
        <div className={isOpen ? 'overflow-visible' : 'overflow-hidden'}>
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            {exams.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">{t('exams_no_exams')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {exams.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    isStudent={isStudent}
                    formatDate={formatDate}

                    fmt={fmt}
                    openModal={openModal}
                    categories={categories}
                    onToggleVisibility={() => onToggleExamVisibility(exam.id, exam.exam_is_hidden)}
                    onToggleArchive={onToggleExamArchive ? () => onToggleExamArchive(exam) : null}
                    nowMs={nowMs}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ExamsPage() {
    const router = useRouter();
    const { t, fmt, timezone } = useLanguage();
  const { user, loading: loadingSession } = useUser();

  const userRole = user?.roleName;
  const userId = user?.id;

  const [exams, setExams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [errorExams, setErrorExams] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false); // To trigger re-fetch
  const [isExecuting, setIsExecuting] = useState(false); // To show loading state on buttons
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('start_time');
  const [archiveFilter, setArchiveFilter] = useState('active'); // 'active' | 'archived' | 'all'
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Accordion state
  const [openCategories, setOpenCategories] = useState({});

  // Satu jam untuk seluruh halaman, bukan satu per kartu: countdown di tiap
  // kartu tetap jalan tanpa puluhan interval yang jalan bersamaan.
  // Nilai awal null supaya render SSR dan hydration sama-sama null.
  const [nowMs, setNowMs] = useState(null);
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Modal State
  const [modalState, setModalState] = useState({
    type: null, // 'duplicate' | 'delete' | 'categoryManage' | 'categoryDelete' | 'moveExam'
    examId: null, // for duplicate/delete/move
    categoryId: null, // for categoryDelete/edit
    categoryName: '', // for categoryEdit
    isOpen: false
  });

  const filteredExams = useMemo(() => {
    if (!exams) return [];
    let result = exams.filter(e => {
      const matchesSearch =
        (e.exam_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.subject_name && e.subject_name.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;

      // Filter arsip: siswa tidak pernah melihat ujian yang diarsipkan
      if (e.is_archived) return archiveFilter !== 'active';
      return archiveFilter !== 'archived';
    });

    if (sortBy === 'start_time') {
      result = [...result].sort((a, b) => {
        const aTime = wallClockToEpochMs(a.start_time, timezone);
        const bTime = wallClockToEpochMs(b.start_time, timezone);

        if (aTime !== null && bTime !== null) return aTime - bTime;
        if (aTime !== null) return -1;
        if (bTime !== null) return 1;
        return (a.exam_name || '').localeCompare(b.exam_name || '');
      });
    }

    return result;
  }, [exams, searchTerm, sortBy, archiveFilter, timezone]);

  const archiveCounts = useMemo(() => {
    const list = exams || [];
    return {
      active: list.filter(e => !e.is_archived).length,
      archived: list.filter(e => !!e.is_archived).length
    };
  }, [exams]);

  // Kategori yang perlu ditampilkan sesuai filter arsip.
  // - Aktif  : hanya kategori yang masih punya ujian aktif (accordion kosong disembunyikan)
  // - Arsip  : hanya kategori yang sudah diarsipkan
  // - Semua  : seluruh kategori
  const visibleCategories = useMemo(() => {
    const hasVisibleExam = new Set();
    filteredExams.forEach(e => hasVisibleExam.add(e.category_id ?? 'uncategorized'));

    if (archiveFilter === 'archived') {
      return categories.filter(c => !!c.is_archived);
    }

    if (archiveFilter === 'all') return categories;

    return categories.filter(c => hasVisibleExam.has(c.id));
  }, [filteredExams, categories, archiveFilter]);

  const hasVisibleUncategorized = useMemo(
    () => filteredExams.some(e => (e.category_id ?? null) === null),
    [filteredExams]
  );

  // Di tab Arsip: ujian terarsip yang kategorinya belum ikut terarsip (atau tanpa kategori)
  // ditampilkan langsung tanpa accordion supaya tetap mudah ditemukan.
  const looseArchivedExams = useMemo(() => {
    if (archiveFilter !== 'archived') return [];
    const archivedCategoryIds = new Set(categories.filter(c => !!c.is_archived).map(c => c.id));
    return filteredExams.filter(e => {
      if (!e.is_archived) return false;
      const catId = e.category_id ?? null;
      if (catId === null) return false; // sudah ditangani accordion "Tanpa Nama"
      return !archivedCategoryIds.has(catId);
    });
  }, [filteredExams, categories, archiveFilter]);

  // Session check and role fetching logic
  // ...
  // [Lines 154-169 unchanged logic, we just need to place new methods above useEffect]
  // ...
  const toggleCategory = (categoryId) => {
    setOpenCategories(prev => {
      const next = { ...prev, [categoryId]: !prev[categoryId] };
      persistOpenCategories(next);
      return next;
    });
  };

  // --- Preferensi UI (disimpan di DB, bukan di browser) ---

  const OPEN_CATEGORIES_KEY = 'exams_open_categories';

  const persistOpenCategories = (state) => {
    const openIds = Object.keys(state).filter(id => state[id]);
    fetch('/api/exams/ui-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: OPEN_CATEGORIES_KEY,
        value: openIds.length ? JSON.stringify(openIds) : null
      })
    }).catch(() => { });
  };

  const loadOpenCategories = async () => {
    try {
      const res = await fetch(`/api/exams/ui-prefs?key=${OPEN_CATEGORIES_KEY}`);
      if (!res.ok) return null;
      const { prefs } = await res.json();
      const raw = prefs?.[OPEN_CATEGORIES_KEY];
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  // --- Arsip ---

  const [archiveTarget, setArchiveTarget] = useState(null); // { scope: 'exam'|'category', ... }
  const [manageCategory, setManageCategory] = useState(null); // kategori yang modal"Kelola" buka

  const handleToggleExamArchive = async (exam) => {
    const nextArchived = !exam.is_archived;
    try {
      const res = await fetch('/api/exams/archive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: exam.id, archived: nextArchived })
      });
      if (!res.ok) throw new Error((await res.json()).message);

      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, is_archived: nextArchived ? 1 : 0 } : e));

      // Kategori ikut terarsip otomatis bila ujian terakhir di dalamnya diarsipkan
      let categoryArchivedName = null;
      if (nextArchived && exam.category_id != null) {
        const remaining = (exams || []).filter(e =>
          e.category_id === exam.category_id && e.id !== exam.id && !e.is_archived
        );
        if (remaining.length === 0) {
          const cat = categories.find(c => c.id === exam.category_id);
          if (cat && !cat.is_archived) {
            const catRes = await fetch('/api/exams/categories/archive', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: cat.id, archived: true })
            });
            if (catRes.ok) {
              categoryArchivedName = cat.name;
              setCategories(prevCats => prevCats.map(c => c.id === cat.id ? { ...c, is_archived: 1 } : c));
            }
          }
        }
      }

      toast.success(
        categoryArchivedName
          ? `"${exam.exam_name}" diarsipkan. Kategori "${categoryArchivedName}" ikut diarsipkan karena tidak ada ujian aktif lagi.`
          : (nextArchived ? `"${exam.exam_name}" diarsipkan.` : `"${exam.exam_name}" dipulihkan.`)
      );
    } catch (e) {
      toast.error(e.message || 'Gagal mengubah status arsip');
    }
  };

  const confirmToggleCategoryArchive = async () => {
    if (!archiveTarget) return;
    const nextArchived = !archiveTarget.isArchived;
    setIsExecuting(true);
    try {
      const res = await fetch('/api/exams/categories/archive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: archiveTarget.id, archived: nextArchived })
      });
      if (!res.ok) throw new Error((await res.json()).message);

      setExams(prev => prev.map(e => (
        (e.category_id ?? null) === archiveTarget.id ? { ...e, is_archived: nextArchived ? 1 : 0 } : e
      )));
      setCategories(prev => prev.map(c => (
        c.id === archiveTarget.id ? { ...c, is_archived: nextArchived ? 1 : 0 } : c
      )));

      toast.success(nextArchived
        ? `"${archiveTarget.name}" beserta ${archiveTarget.examCount} ujian diarsipkan.`
        : `"${archiveTarget.name}" beserta ${archiveTarget.examCount} ujian dipulihkan.`);

      setArchiveTarget(null);
      refreshData();
    } catch (e) {
      toast.error(e.message || 'Gagal mengubah status arsip');
    } finally {
      setIsExecuting(false);
    }
  };

  const openModal = (type, examId = null, categoryId = null, categoryName = '') => {
    setModalState({ type, examId, categoryId, categoryName, isOpen: true });
  };

  const closeModal = () => {
    setModalState({ type: null, examId: null, categoryId: null, categoryName: '', isOpen: false });
  };

  const handleToggleVisibility = async (type, id, currentStatus, mode = 'hidden') => {
    try {
      let endpoint = '';
      let body = {};

      if (type === 'exam') {
        endpoint = '/api/exams/toggle-visibility';
        body = { examId: id, isHidden: !currentStatus };
      } else {
        endpoint = '/api/exams/categories/toggle-visibility';
        if (mode === 'admin_hidden') {
          body = { categoryId: id, isAdminHidden: !currentStatus };
        } else {
          body = { categoryId: id, isHidden: !currentStatus };
        }
      }

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error((await res.json()).message);
      
      toast.success(t('exams_toast_visibility_success'));
      refreshData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleMoveCategory = async (categoryId, direction) => {
    // Legacy support or removed? Let's just remove it.
  };

  const [draggedCategoryId, setDraggedCategoryId] = useState(null);

  const handleDragStart = (e, id) => {
    setDraggedCategoryId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    if (id === draggedCategoryId) return;
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    const sourceId = draggedCategoryId;
    if (sourceId === targetId || !sourceId) return;

    // Optimistic UI update
    const newCategories = [...categories];
    const sourceIndex = newCategories.findIndex(c => c.id === sourceId);
    const targetIndex = newCategories.findIndex(c => c.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    // Splice and insert
    const [movedItem] = newCategories.splice(sourceIndex, 1);
    newCategories.splice(targetIndex, 0, movedItem);

    setCategories(newCategories);

    // Call API
    try {
      const orderedIds = newCategories.map(c => c.id);
      const res = await fetch('/api/exams/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      
      toast.success(t('exams_toast_reorder_success'));
      // No need to refreshData() if optimistic update is correct, 
      // but let's do it to be safe and ensure sort_order is in sync.
      refreshData();
    } catch (e) {
      toast.error(e.message);
      refreshData(); // Revert on error
    }
  };

  const handleDragEnd = () => {
    setDraggedCategoryId(null);
  };


  // Muat status accordion yang tersimpan di DB (hanya sekali per sesi)
  const savedOpenRef = useRef(undefined);

  useEffect(() => {
    if (loadingSession) return;
    let cancelled = false;
    loadOpenCategories().then(saved => {
      if (cancelled) return;
      savedOpenRef.current = saved || [];
      setOpenCategories(prev => {
        if (Object.keys(prev).length > 0) return prev;
        if (saved && saved.length > 0) {
          return saved.reduce((acc, id) => { acc[id] = true; return acc; }, {});
        }
        // Belum pernah ada preferensi: buka "Tanpa Nama" + kategori pertama
        return { 'uncategorized': true };
      });
    });
    return () => { cancelled = true; };
  }, [loadingSession]);

  // Fetch exams logic with SSE
  useEffect(() => {
    if (loadingSession) return;

    let isMounted = true;
    let eventSource = null;

    const processExamsData = (data) => {
      if (!isMounted) return;

      const { exams: examsData, categories: categoriesDataList } = data;
      setExams(examsData);

      const fetchedCategories = (categoriesDataList || []).map(cat => ({
        ...cat,
        isHidden: !!cat.is_hidden,
        isAdminHidden: !!cat.is_admin_hidden
      }));

      setCategories(fetchedCategories);

      setOpenCategories(prev => {
        if (Object.keys(prev).length > 0) return prev;
        // Preferensi belum selesai dimuat: tunggu dulu supaya tidak menimpa
        if (savedOpenRef.current === undefined) return prev;

        const saved = savedOpenRef.current;
        const initialOpen = {};
        if (saved.length > 0) {
          saved.forEach(id => { initialOpen[id] = true; });
        } else {
          initialOpen['uncategorized'] = true;
          if (fetchedCategories.length > 0) {
            initialOpen[fetchedCategories[0].id] = true;
          }
        }
        return initialOpen;
      });

      setLoadingExams(false);
    };

    const setupSSE = () => {
      if (eventSource) eventSource.close();

      eventSource = new EventSource('/api/exams/stream');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          processExamsData(data);
        } catch (err) {
          console.error("SSE Parse Error:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE Connection Error:", err);
        eventSource.close();
        // Fallback to manual refresh if SSE fails consistently, 
        // or just let it try to reconnect automatically (browser handles this)
        if (isMounted) {
          // If connection is lost, try to reconnect after 5 seconds
          setTimeout(setupSSE, 5000);
        }
      };
    };

    setupSSE();
    
    // 2. Initial Fetch for immediate data
    const fetchInitialData = async () => {
      try {
        const res = await fetch('/api/exams/stream');
        // The stream endpoint also sends initial data on the first line normally, 
        // but a direct fetch is safer for immediate UI.
        // However, /api/exams/stream is a GET stream. 
        // Let's use a standard fetch to a non-stream endpoint if possible, 
        // or just rely on the first message from SSE.
      } catch (err) { }
    };

    // 3. Handle window focus (Refresh when student comes back from exam tab)
    const handleFocus = () => {
      console.log("[ExamsPage] Window focused, refreshing data...");
      refreshData();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      if (eventSource) eventSource.close();
    };
  }, [loadingSession, isRefreshing, userRole]); // Removed loadingExams to break loop

  const refreshData = () => {
    setIsRefreshing(prev => !prev);
  };

  const executeAction = async () => {
    const { type, examId, categoryId, categoryName } = modalState;
    if (!type) return;

    setIsExecuting(true);
    try {
      let res;
      if (type === 'duplicate') {
        res = await fetch('/api/exams/duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examId })
        });
      } else if (type === 'delete') {
        res = await fetch(`/api/exams?id=${examId}`, {
          method: 'DELETE'
        });
      } else if (type === 'categoryManage') {
        if (categoryId) {
          // Rename Category
          res = await fetch(`/api/exams/categories`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: categoryId, name: categoryName })
          });
        } else {
          // Create Category
          res = await fetch(`/api/exams/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: categoryName })
          });
        }
      } else if (type === 'categoryDelete') {
        res = await fetch(`/api/exams/categories?id=${categoryId}`, {
          method: 'DELETE'
        });
      } else if (type === 'moveExam') {
        res = await fetch(`/api/exams/move-category`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examId, categoryId })
        });
      }

      if (!res.ok) throw new Error((await res.json()).message);

      // Success Notifications
      if (type === 'duplicate') toast.success(t('exams_toast_duplicate_success'));
      else if (type === 'delete') toast.success(t('exams_toast_delete_success'));
      else if (type === 'categoryManage') {
        if (categoryId) toast.success(t('exams_toast_category_rename_success'));
        else toast.success(t('exams_toast_category_create_success'));
      } else if (type === 'categoryDelete') toast.success(t('exams_toast_category_delete_success'));
      else if (type === 'moveExam') toast.success(t('exams_toast_move_success'));

      refreshData();
      closeModal();
    } catch (e) {
      toast.error(e.message);
      closeModal();
    } finally {
      setIsExecuting(false);
    }
  };

  const formatDate = (dateString) => {
    return fmt.date(dateString);
  };

  const isStudent = userRole === 'student';

  if (loadingSession || loadingExams) {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-4 w-80 max-w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[0, 1, 2].map(j => (
                <div key={j} className="h-44 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (errorExams) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
          <Icons.Alert className="w-5 h-5" />
        </div>
        <p className="text-sm font-bold text-slate-800 dark:text-white">Gagal memuat daftar ujian</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{errorExams}</p>
        <button
          onClick={refreshData}
          className="mt-1 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Coba lagi
        </button>
      </div>
    );
  }

return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {isStudent ? t('exams_title_student') : t('exams_title_admin')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isStudent
              ? 'Daftar ujian yang tersedia untuk kelas kamu. Klik ujian untuk mulai mengerjakan.'
              : 'Kelola seluruh ujian: atur soal, jadwal, dan lihat hasil siswa.'}
          </p>
        </div>

        {!isStudent && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => openModal('categoryManage')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Icons.Folder className="w-4 h-4" />
              {t('exams_btn_categories')}
            </button>
<button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
            >
              <Icons.Plus className="w-4 h-4" />
              {t('exams_btn_create')}
            </button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icons.Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder={t('exams_search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={t('exams_search_placeholder')}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              aria-label="Bersihkan pencarian"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Icons.Close className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Arsip (admin & guru) */}
          {!isStudent && (
            <div className="flex items-center gap-1 p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              {[
                { key: 'active', label: 'Aktif', count: archiveCounts.active },
                { key: 'archived', label: 'Arsip', count: archiveCounts.archived },
                { key: 'all', label: 'Semua', count: archiveCounts.active + archiveCounts.archived }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setArchiveFilter(f.key)}
                  aria-pressed={archiveFilter === f.key}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${archiveFilter === f.key
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  {f.key === 'archived' && <Icons.Archive className="w-3.5 h-3.5" />}
                  {f.label}
                  <span className={archiveFilter === f.key ? 'opacity-70' : 'text-slate-400'}>{f.count}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setSortBy(sortBy === 'start_time' ? 'default' : 'start_time')}
            aria-pressed={sortBy === 'start_time'}
            title={sortBy === 'start_time' ? 'Urutkan berdasarkan jadwal, klik untuk kembali ke urutan bawaan' : 'Urutkan berdasarkan jadwal'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${sortBy === 'start_time'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            {sortBy === 'start_time' ? <Icons.ArrowUp className="w-4 h-4" /> : <Icons.ArrowDown className="w-4 h-4" />}
            {t('exams_btn_sort')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
<span className="font-semibold">Keterangan:</span>
        <span>{filteredExams.length} dari {exams.length} ujian ditampilkan</span>
        {!isStudent && archiveFilter === 'archived' && looseArchivedExams.length > 0 && (
          <span>· ujian tanpa kategori terarsip ditampilkan langsung, tanpa accordion</span>
        )}
        {!isStudent && (
          <>
            <span>· arsip hanya disembunyikan dari siswa, datanya tetap utuh</span>
            <span>· status buka/tutup tiap kategori diingat otomatis</span>
          </>
        )}
      </div>

          {filteredExams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
            {archiveFilter === 'archived' ? <Icons.Archive className="w-5 h-5" /> : <Icons.FileText className="w-5 h-5" />}
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            {archiveFilter === 'archived'
              ? 'Belum ada ujian di arsip'
              : archiveFilter === 'active' && archiveCounts.archived > 0 && !searchTerm
                ? 'Semua ujian sudah diarsipkan'
                : (searchTerm ? t('exams_empty_match') : t('exams_empty_found'))}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {archiveFilter === 'archived'
              ? 'Ujian yang diarsipkan akan muncul di sini. Arsip tidak menghapus data.'
              : archiveFilter === 'active' && archiveCounts.archived > 0 && !searchTerm
                ? `Ada ${archiveCounts.archived} ujian di arsip. Pilih tab Arsip untuk melihat atau memulihkannya.`
                : (searchTerm
                  ? t('exams_empty_adjust')
                  : (isStudent ? t('exams_empty_student') : t('exams_empty_admin')))}
          </p>
          {(searchTerm || (!isStudent && archiveFilter !== 'active')) && (
            <button
              onClick={() => { setSearchTerm(''); if (!isStudent) setArchiveFilter('active'); }}
              className="mt-4 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {archiveFilter === 'archived' ? 'Kembali ke ujian aktif' : 'Tampilkan semua ujian'}
            </button>
          )}
          {!isStudent && archiveFilter === 'active' && archiveCounts.archived > 0 && !searchTerm && (
            <button
              onClick={() => setArchiveFilter('archived')}
              className="mt-2 ml-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
            >
              Buka Arsip ({archiveCounts.archived})
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tanpa Nama Category (Uncategorized) â€” disembunyikan bila tidak ada isinya */}
          {hasVisibleUncategorized && (
            <CategoryAccordion
              id="uncategorized"
              name={t('exams_category_none')}
              exams={filteredExams.filter(e => e.category_id == null)}
              isOpen={openCategories['uncategorized']}
              toggleOpen={() => toggleCategory('uncategorized')}
              isStudent={isStudent}
              formatDate={formatDate}

              fmt={fmt}
              openModal={openModal}
              categories={categories}
              isHidden={false}
              isAdminHidden={false}
              onToggleExamVisibility={(id, current) => handleToggleVisibility('exam', id, current)}
              onToggleExamArchive={handleToggleExamArchive}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              isDragging={draggedCategoryId === 'uncategorized'}
              userRole={userRole}
              userId={userId}
              nowMs={nowMs}
            />
          )}

          {/* User Created Categories */}
{visibleCategories.map(cat => (
            <CategoryAccordion
              key={cat.id}
              id={cat.id}
              name={cat.name}
              exams={filteredExams.filter(e => e.category_id === cat.id)}
              isOpen={openCategories[cat.id]}
              toggleOpen={() => toggleCategory(cat.id)}
              isStudent={isStudent}
              formatDate={formatDate}

              fmt={fmt}
              openModal={openModal}
              categories={categories}
              isHidden={cat.is_hidden}
              isAdminHidden={cat.is_admin_hidden}
              onToggleVisibility={(mode) => handleToggleVisibility('category', cat.id, mode === 'admin_hidden' ? cat.is_admin_hidden : cat.is_hidden, mode)}
              onToggleExamVisibility={(id, current) => handleToggleVisibility('exam', id, current)}
              onToggleExamArchive={handleToggleExamArchive}
              isArchived={!!cat.is_archived}
              onToggleArchive={() => setArchiveTarget({
                id: cat.id,
                name: cat.name,
                isArchived: !!cat.is_archived,
                examCount: (exams || []).filter(e => (e.category_id ?? null) === cat.id).length
              })}
              onOpenManage={() => setManageCategory({
                id: cat.id,
                name: cat.name,
                examCount: (exams || []).filter(e => (e.category_id ?? null) === cat.id).length,
                isHidden: !!cat.is_hidden,
                isAdminHidden: !!cat.is_admin_hidden,
                isArchived: !!cat.is_archived
              })}
              onEdit={(e) => { e.stopPropagation(); openModal('categoryManage', null, cat.id, cat.name); }}
              onDelete={(e) => { e.stopPropagation(); openModal('categoryDelete', null, cat.id); }}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              isDragging={draggedCategoryId === cat.id}
              userRole={userRole}
              userId={userId}
              categoryCreatedBy={cat.created_by}
              nowMs={nowMs}
            />
          ))}

          {/* Ujian terarsip yang kategorinya belum terarsip: tampil tanpa accordion */}
          {looseArchivedExams.length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 px-1 pb-2">
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-400">
                  <Icons.Archive className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Ujian Arsip (tanpa kategori)</h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold tabular-nums border border-slate-200 dark:border-slate-700">
                  {looseArchivedExams.length} ujian
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {looseArchivedExams.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    isStudent={isStudent}
                    formatDate={formatDate}

                    fmt={fmt}
                    openModal={openModal}
                    categories={categories}
                    onToggleVisibility={() => handleToggleVisibility('exam', exam.id, exam.exam_is_hidden)}
                    onToggleArchive={handleToggleExamArchive}
                    nowMs={nowMs}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Kelola Kategori */}
      {manageCategory && (
        <CategoryManageModal
          category={manageCategory}
          isAdmin={userRole === 'admin'}
          onClose={() => setManageCategory(null)}
          onArchive={() => {
            const target = manageCategory;
            setManageCategory(null);
            setArchiveTarget(target);
          }}
          onToggleVisibility={async (mode) => {
            await handleToggleVisibility('category', manageCategory.id, mode === 'admin_hidden' ? manageCategory.isAdminHidden : manageCategory.isHidden, mode);
            setManageCategory(prev => prev ? {
              ...prev,
              isHidden: mode === 'hidden' ? !prev.isHidden : prev.isHidden,
              isAdminHidden: mode === 'admin_hidden' ? !prev.isAdminHidden : prev.isAdminHidden
            } : prev);
          }}
          onRename={() => {
            const cat = manageCategory;
            setManageCategory(null);
            openModal('categoryManage', null, cat.id, cat.name);
          }}
          onDelete={() => {
            const cat = manageCategory;
            setManageCategory(null);
            openModal('categoryDelete', null, cat.id);
          }}
        />
      )}

      {/* Modal Buat Ujian Baru */}
      {showCreateModal && (
        <CreateExamModal
          isTeacher={userRole === 'teacher'}
          defaultCategoryId={modalState.categoryId || (categories[0]?.id ?? null)}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            refreshData();
          }}
        />
      )}

      {/* Modals */}
      {/* Kategori Ujian: buat / ubah nama */}
      {modalState.isOpen && modalState.type === 'categoryManage' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-6" onClick={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full sm:max-w-md sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70 shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Strip amber saat mengubah, indigo saat membuat. */}
            <div aria-hidden className={`h-1 w-full bg-gradient-to-r ${modalState.categoryId ? 'from-amber-500 to-orange-500' : 'from-indigo-500 to-violet-500'}`} />

            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className={`text-base font-bold ${modalState.categoryId ? 'text-amber-700 dark:text-amber-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                {modalState.categoryId ? 'Ubah Nama Kategori' : 'Kategori Ujian'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kategori mengelompokkan ujian di daftar ini, misalnya per mata pelajaran atau tahun.
              </p>
            </div>

            <div className="p-5">
              <label htmlFor="categoryNameInput" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Nama kategori
              </label>
              <input
                id="categoryNameInput"
                type="text"
                value={modalState.categoryName}
                onChange={(e) => setModalState(prev => ({ ...prev, categoryName: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && modalState.categoryName.trim()) executeAction(); }}
                placeholder="Contoh: Matematika"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-colors"
                autoFocus
              />
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-end gap-2">
              <button onClick={closeModal} disabled={isExecuting} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50">
                {t('users_btn_cancel')}
              </button>
              <button onClick={executeAction} disabled={!modalState.categoryName.trim() || isExecuting} className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${modalState.categoryId
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-300/50 dark:shadow-amber-950/40'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-300/50 dark:shadow-indigo-950/40'}`}>
                {isExecuting && <Icons.Spinner className="w-4 h-4" />}
                <span>{isExecuting ? t('layout_loading') : t('users_btn_save')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pindahkan Ujian ke Kategori Lain */}
      {modalState.isOpen && modalState.type === 'moveExam' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-6" onClick={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full sm:max-w-md sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70 shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div aria-hidden className="h-1 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />

            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-violet-700 dark:text-violet-300">Pindahkan Ujian</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ujian akan dipindah ke kategori yang dipilih.</p>
            </div>

            <div className="p-5">
              <label htmlFor="moveCategorySelect" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Kategori tujuan
              </label>
              <select
                id="moveCategorySelect"
                value={modalState.categoryId || ''}
                onChange={(e) => setModalState(prev => ({ ...prev, categoryId: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:border-violet-400 dark:focus:border-violet-600 focus:ring-4 focus:ring-violet-500/20 transition-colors"
              >
                <option value="">{t('exams_category_none')}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-end gap-2">
              <button onClick={closeModal} disabled={isExecuting} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50">
                {t('users_btn_cancel')}
              </button>
              <button onClick={executeAction} disabled={isExecuting} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-300/50 dark:shadow-violet-950/40 transition-all disabled:opacity-50">
                {isExecuting && <Icons.Spinner className="w-4 h-4" />}
                <span>{isExecuting ? t('layout_loading') : t('exams_modal_move_title')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={modalState.isOpen && modalState.type === 'categoryDelete'}
        onClose={closeModal}
        onConfirm={executeAction}
        title={t('exams_modal_category_delete_title')}
        message={t('exams_modal_delete_msg')}
        confirmText={t('users_btn_delete')}
        tone="danger"
        icon={() => <Icons.Trash className="w-5 h-5" />}
        isExecuting={isExecuting}
      />
      <ConfirmationModal
        isOpen={modalState.isOpen && modalState.type === 'duplicate'}
        onClose={closeModal}
        onConfirm={executeAction}
        title={t('exams_modal_duplicate_title')}
        message={t('exams_modal_duplicate_msg')}
        confirmText={t('exams_btn_duplicate')}
        tone="amber"
        icon={() => <Icons.Duplicate className="w-5 h-5" />}
        isExecuting={isExecuting}
      />

      <ConfirmationModal
        isOpen={modalState.isOpen && modalState.type === 'delete'}
        onClose={closeModal}
        onConfirm={executeAction}
        title={t('exams_modal_delete_title')}
        message={t('exams_modal_delete_msg')}
        confirmText={t('users_btn_delete')}
        tone="danger"
        icon={() => <Icons.Trash className="w-5 h-5" />}
        isExecuting={isExecuting}
      />

      {/* Arsip / Pulihkan Accordion (kategori) */}
      <ConfirmationModal
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={confirmToggleCategoryArchive}
        title={archiveTarget?.isArchived ? 'Pulihkan Kategori dari Arsip?' : 'Arsipkan Kategori?'}
        message={archiveTarget
          ? (archiveTarget.isArchived
            ? `Kategori "${archiveTarget.name}" beserta ${archiveTarget.examCount} ujian di dalamnya akan dikembalikan ke daftar aktif dan kembali terlihat oleh siswa.`
            : `Kategori "${archiveTarget.name}" beserta ${archiveTarget.examCount} ujian di dalamnya akan dipindahkan ke arsip. Siswa tidak akan melihatnya lagi, dan data tetap tersimpan.`)
          : ''}
        confirmText={archiveTarget?.isArchived ? 'Pulihkan' : 'Arsipkan'}
        icon={() => archiveTarget?.isArchived
          ? <Icons.Unarchive className="w-5 h-5" />
          : <Icons.Archive className="w-5 h-5" />}
        tone={"slate"}
        isExecuting={isExecuting}
      />
    </div>
  );
}

/**
 * Modal Buat Ujian Baru â€” menggantikan halaman /dashboard/exams/baru
 */
function CreateExamModal({ isTeacher, onClose, onCreated }) {
  const [examName, setExamName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [requireSafeBrowser, setRequireSafeBrowser] = useState(false);
  const [requireSeb, setRequireSeb] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [subjectsRes, classesRes] = await Promise.all([fetch('/api/subjects'), fetch('/api/classes')]);
        if (cancelled) return;
        if (subjectsRes.ok) {
          const data = await subjectsRes.json();
          setSubjects(Array.isArray(data) ? data : []);
        }
        if (classesRes.ok) {
          const data = await classesRes.json();
          if (cancelled) return;
          const list = Array.isArray(data) ? data : [];
          setClasses(list);
          if (isTeacher && list.length > 0) setSelectedClasses(list.map(c => c.id));
        }
      } catch (e) {
        console.error('Gagal memuat data:', e);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isTeacher]);

  const toggleClass = (classId) => {
    setSelectedClasses(prev => prev.includes(classId)
      ? prev.filter(id => id !== classId)
      : [...prev, classId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!examName.trim()) {
      setError('Nama ujian wajib diisi.');
      return;
    }
    if (selectedClasses.length === 0) {
      setError('Pilih minimal satu kelas yang boleh mengikuti ujian ini.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_name: examName.trim(),
          description,
          require_safe_browser: requireSafeBrowser,
          require_seb: requireSeb,
          subject_id: subjectId || null,
          allowed_classes: selectedClasses
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Gagal membuat ujian');
      }

      toast.success(`Ujian "${examName.trim()}" berhasil dibuat.`);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buat ujian baru"
        className="relative w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70 shadow-xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div aria-hidden className="h-1 w-full shrink-0 bg-gradient-to-r from-emerald-500 to-teal-500" />

        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Icons.Plus className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-300">Buat Ujian Baru</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Isi data dasar dulu. Soal, jadwal, dan pengaturan lain bisa dilengkapi setelah ujian dibuat.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Icons.Close className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
              <Icons.Alert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="createExamName" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Nama ujian <span className="text-rose-500">*</span>
            </label>
            <input
              id="createExamName"
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="Contoh: Ujian Akhir Semester Matematika"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="createExamSubject" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Mata pelajaran
              </label>
              <select
                id="createExamSubject"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={loadingData}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 transition-colors"
              >
                <option value="">Tanpa mata pelajaran</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Kelas peserta <span className="text-rose-500">*</span>
              </label>
              {loadingData ? (
                <div className="h-[38px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ) : classes.length === 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-300 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
                  Belum ada kelas. Buat kelas terlebih dahulu.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {classes.map(cls => {
                    const isSelected = selectedClasses.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => toggleClass(cls.id)}
                        aria-pressed={isSelected}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 ${isSelected
                          ? 'bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-300/50 dark:shadow-violet-950/40'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-800 hover:text-violet-700 dark:hover:text-violet-300'}`}
                      >
                        {isSelected && <Icons.Check className="w-3 h-3" />}
                        {cls.class_name}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                Dipilih: {selectedClasses.length} kelas. Ujian tidak akan terlihat oleh siswa di luar kelas ini.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="createExamDesc" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Deskripsi <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <textarea
              id="createExamDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Penjelasan singkat tentang ujian ini."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleCard
              id="createRequireSafer"
              checked={requireSafeBrowser}
              onChange={setRequireSafeBrowser}
              title="Rushless Safer"
              description="Siswa hanya bisa ujian lewat aplikasi Rushless Safer."
            />
            <ToggleCard
              id="createRequireSeb"
              checked={requireSeb}
              onChange={setRequireSeb}
              title="Safe Exam Browser"
              description="Siswa hanya bisa ujian lewat aplikasi SEB."
            />
          </div>
        </form>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Setelah dibuat, ujian muncul di daftar. Klik Kelola untuk menambah soal.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || loadingData}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-300/50 dark:shadow-emerald-950/40 transition-all disabled:opacity-50"
            >
              {saving && <Icons.Spinner className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'Buat Ujian'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleCard({ id, checked, onChange, title, description }) {
  return (
    <label htmlFor={id} className={`flex items-start justify-between gap-3 px-3.5 py-3 rounded-xl border transition-colors cursor-pointer ${checked
      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20'
      : 'border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800'}`}>
      <span className="min-w-0">
        <span className={`block text-sm font-bold ${checked ? 'text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-100'}`}>{title}</span>
        <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>
      </span>
      <span className="relative shrink-0 mt-0.5">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="block w-10 h-5 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors peer-checked:bg-rose-500 peer-focus-visible:ring-2 peer-focus-visible:ring-rose-400 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-slate-900" />
        <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
/**
 * Modal pengaturan kategori (dipakai dari tombol "Kelola" pada accordion)
 */
function CategoryManageModal({ category, onClose, onArchive, onToggleVisibility, onRename, onDelete, isAdmin }) {
  if (!category) return null;

  const { name, examCount, isHidden, isAdminHidden, isArchived } = category;

  const rows = [
    {
      key: 'archive',
      icon: isArchived ? <Icons.Unarchive className="w-4 h-4" /> : <Icons.Archive className="w-4 h-4" />,
      title: isArchived ? 'Pulihkan dari arsip' : 'Arsipkan kategori',
      desc: isArchived
        ? 'Kembalikan kategori dan semua ujiannya ke daftar utama.'
        : 'Sembunyikan dari daftar utama. Semua ujian di dalamnya ikut terarsip dan tidak terlihat siswa.',
      onClick: onArchive,
      tone: isArchived ? 'default' : 'default'
    },
    {
      key: 'students',
      icon: isHidden ? <Icons.EyeOff className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />,
      title: isHidden ? 'Tampilkan kembali ke siswa' : 'Sembunyikan dari siswa',
      desc: isHidden
        ? 'Ujian dalam kategori ini akan tampil lagi di daftar siswa.'
        : 'Siswa tidak bisa melihat ujian di kategori ini. Guru tetap bisa.',
      onClick: () => onToggleVisibility('hidden'),
      badge: isHidden ? 'Tersembunyi' : 'Terlihat',
      badgeTone: isHidden ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
    },
    ...(isAdmin ? [{
      key: 'admin',
      icon: <Icons.Shield className="w-4 h-4" />,
      title: isAdminHidden ? 'Tampilkan untuk guru & siswa' : 'Sembunyikan dari guru & siswa',
      desc: isAdminHidden
        ? 'Kategori akan terlihat lagi oleh seluruh pengguna.'
        : 'Sembunyikan kategori ini dari seluruh pengguna, termasuk guru.',
      onClick: () => onToggleVisibility('admin_hidden'),
      badge: isAdminHidden ? 'Disembunyikan total' : 'Terlihat semua',
      badgeTone: isAdminHidden ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
    }] : []),
    {
      key: 'rename',
      icon: <Icons.Cog className="w-4 h-4" />,
      title: 'Ubah nama kategori',
      desc: 'Mengganti label kategori di daftar ujian.',
      onClick: onRename,
      separator: true
    },
    {
      key: 'delete',
      icon: <Icons.Trash className="w-4 h-4" />,
      title: 'Hapus kategori',
      desc: 'Ujian di dalamnya tidak ikut terhapus, hanya dipindahkan ke Tanpa Nama.',
      onClick: onDelete,
      danger: true
    }
  ];

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Pengaturan kategori ${name}`}
        className="w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[88vh] sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70 shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="h-1 w-full shrink-0 bg-gradient-to-r from-sky-500 to-cyan-500" />

        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <Icons.Folder className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-sky-700 dark:text-sky-300 truncate">Kelola Kategori</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {name} - berlaku untuk {examCount} ujian di dalamnya.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Icons.Close className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {rows.map((row, i) => (
            <div key={row.key}>
              {row.separator && <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />}
              <button
                onClick={row.onClick}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 ${row.danger
                  ? 'hover:bg-rose-50 dark:hover:bg-rose-950/30'
                  : 'hover:bg-sky-50 dark:hover:bg-sky-950/20'} ${i === rows.length - 1 ? '' : ''}`}
              >
                <span className={`shrink-0 grid place-items-center w-8 h-8 rounded-lg ${row.danger
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  : 'bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400'}`}>{row.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-bold ${row.danger ? 'text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-100'}`}>
                    {row.title}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{row.desc}</span>
                </span>
                {row.badge && (
                  <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${row.badgeTone}`}>
                    {row.badge}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Perubahan berlaku langsung ke semua ujian di kategori ini.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-300/50 dark:shadow-sky-950/40 transition-all"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', icon: Icon, isExecuting = false, tone = 'slate' }) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const toneCls = tone === 'danger'
    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
    : tone === 'amber'
      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';

  // Strip atas + warna tombol + warna judul semua diturunkan dari `tone`, bukan
  // dari confirmColor terpisah, jadi tidak mungkin warna tombol beda dengan
  // warna ikon di header modal.
  const stripCls = tone === 'danger'
    ? 'from-rose-500 to-pink-500'
    : tone === 'amber'
      ? 'from-amber-500 to-orange-500'
      : 'from-slate-400 to-slate-300';
  const btnCls = tone === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-300/50 dark:shadow-rose-950/40'
    : tone === 'amber'
      ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-300/50 dark:shadow-amber-950/40'
      : 'bg-slate-600 hover:bg-slate-700 shadow-slate-300/50 dark:shadow-slate-950/40';
  const titleCls = tone === 'danger'
    ? 'text-rose-700 dark:text-rose-300'
    : tone === 'amber'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-slate-900 dark:text-white';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-md sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70 shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div aria-hidden className={`h-1 w-full bg-gradient-to-r ${stripCls}`} />

        <div className="p-5">
          <div className="flex items-start gap-3">
            {Icon && (
              <span className={`shrink-0 grid place-items-center w-10 h-10 rounded-xl ${toneCls}`}>
                <Icon className="w-5 h-5" />
              </span>
            )}
            <div className="min-w-0">
              <h3 className={`text-base font-bold ${titleCls}`}>{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{message}</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            {t('users_btn_cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isExecuting}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 ${btnCls}`}
          >
            {isExecuting && <Icons.Spinner className="w-4 h-4" />}
            <span>{isExecuting ? t('layout_loading') : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
