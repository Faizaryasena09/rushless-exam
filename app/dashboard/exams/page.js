'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/app/context/UserContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { toast } from 'sonner';

// --- Icons ---
const Icons = {
  Plus: (props) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  ChevronRight: (props) => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>,
  Calendar: (props) => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
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
  Search: (props) => <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
};

// --- Student Action Button Component ---
const StudentExamActions = ({ exam }) => {
  const { t } = useLanguage();
  const now = Date.now();

  const startTime = exam.start_time ? new Date(exam.start_time).getTime() : null;
  const endTime = exam.end_time ? new Date(exam.end_time).getTime() : null;
  const maxAttempts = exam.max_attempts ? Number(exam.max_attempts) : null;
  const userAttempts = exam.user_attempts || 0;
  const hasInProgress = !!exam.has_in_progress;
  const latestAttemptId = exam.latest_attempt_id;
  const latestScore = exam.latest_score;

  // Determine exam window status
  const examNotStarted = startTime !== null && now < startTime;
  const examEnded = endTime !== null && now > endTime;
  const maxAttemptsReached = maxAttempts !== null && userAttempts >= maxAttempts;
  const canTakeExam = !examNotStarted && !examEnded && !maxAttemptsReached;

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

  // Badge status
  let badge = null;
  if (examNotStarted) {
    badge = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
        🔒 {t('exams_badge_not_started')}
      </span>
    );
  } else if (hasInProgress && !examEnded) {
    badge = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
        ⚡ {t('exams_badge_in_progress')}
      </span>
    );
  } else if (examEnded || maxAttemptsReached) {
    badge = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        ✅ {examEnded ? t('exams_badge_ended') : t('exams_badge_finished')}
      </span>
    );
  } else if (canTakeExam) {
    badge = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
        🟢 {t('exams_badge_available')}
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
      <div key="status" className="flex items-center gap-2 text-sm font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed select-none">
        <Icons.Clock />
        <span>{t('exams_status_not_started')} {formatCountdown(startTime)}</span>
      </div>
    );
  } else if (hasInProgress && !examEnded) {
    const isSecure = (exam.require_safe_browser || exam.require_seb || exam.require_geschool) && !isAndroidApp;
    
    actions.push(
      <div key="in_progress" className="flex flex-col gap-2">
        {isSecure ? (
          showMethods && enabledMethods.length > 1 ? (
             <div className="flex flex-col gap-1.5 p-2 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 px-1">Pilih Aplikasi:</p>
                {enabledMethods.map(m => (
                  <button
                    key={m.id}
                    onClick={m.handler}
                    disabled={isLaunching}
                    className={`w-full flex items-center justify-between px-3 py-2 ${m.color} text-white rounded-lg text-xs font-bold transition-all ${isLaunching ? 'opacity-70 cursor-wait' : 'active:scale-95'}`}
                  >
                    <div className="flex items-center gap-2">
                      {m.icon}
                      <span>{isLaunching ? t('layout_loading') : m.label}</span>
                    </div>
                    <Icons.ChevronRight className="w-3 h-3" />
                  </button>
                ))}
                <button onClick={() => setShowMethods(false)} className="text-[10px] text-slate-400 hover:text-slate-600 text-center mt-1 py-1 font-bold">Batal</button>
             </div>
          ) : (
            <button
              onClick={enabledMethods.length > 1 ? () => setShowMethods(true) : enabledMethods[0]?.handler}
              disabled={isLaunching}
              className={`w-full flex items-center justify-center gap-2 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-yellow-200 dark:shadow-none ${isLaunching ? 'opacity-70 cursor-wait' : ''}`}
            >
               <Icons.Play className="w-4 h-4" />
               <span>{isLaunching ? t('layout_loading') : enabledMethods.length > 1 ? 'Lanjutkan (Pilih Aplikasi)' : t('exams_action_continue')}</span>
            </button>
          )
        ) : (
          <Link href={`/dashboard/exams/kerjakan/${exam.id}`} className="group w-full flex items-center justify-between text-sm font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 transition-colors">
            <div className="flex items-center gap-2">
              <Icons.Play />
              <span>{t('exams_action_continue')}</span>
            </div>
            <Icons.ChevronRight />
          </Link>
        )}
      </div>
    );
  } else {
    // 1. Show Results if configured and we have at least one attempt ID
    if (latestAttemptId && latestFinished) {
      if (showResultsSetting) {
        actions.push(
          <Link key="results" href={`/dashboard/exams/hasil/${latestAttemptId}`} className="group w-full flex items-center justify-between text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors py-1">
            <div className="flex items-center gap-2">
              <Icons.ChartBar />
              <span>{t('exams_btn_results')} {latestScore !== null && latestScore !== undefined ? `(${Number(latestScore) % 1 === 0 ? latestScore : Number(latestScore).toFixed(2)})` : ''}</span>
            </div>
            <Icons.ChevronRight />
          </Link>
        );
      } else if (examEnded || maxAttemptsReached) {
        actions.push(
          <div key="results_hidden" className="flex items-center gap-2 text-sm font-medium text-slate-400 dark:text-slate-500 cursor-default select-none py-1">
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
                <div className="flex flex-col gap-1.5 p-2 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 px-1">Pilih Aplikasi:</p>
                   {enabledMethods.map(m => (
                     <button
                       key={m.id}
                       onClick={m.handler}
                       disabled={isLaunching}
                       className={`w-full flex items-center justify-between px-3 py-2 ${m.color} text-white rounded-lg text-xs font-bold transition-all ${isLaunching ? 'opacity-70 cursor-wait' : 'active:scale-95'}`}
                     >
                       <div className="flex items-center gap-2">
                         {m.icon}
                         <span>{isLaunching ? t('layout_loading') : m.label}</span>
                       </div>
                       <Icons.ChevronRight className="w-3 h-3" />
                     </button>
                   ))}
                   <button onClick={() => setShowMethods(false)} className="text-[10px] text-slate-400 hover:text-slate-600 text-center mt-1 py-1 font-bold">Batal</button>
                </div>
             ) : (
              <button
                onClick={enabledMethods.length > 1 ? () => setShowMethods(true) : enabledMethods[0]?.handler}
                disabled={isLaunching}
                className={`w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-200 dark:shadow-none ${isLaunching ? 'opacity-70 cursor-wait' : ''}`}
              >
                 <Icons.Play className="w-4 h-4" />
                 <span>{isLaunching ? t('layout_loading') : enabledMethods.length > 1 ? (userAttempts > 0 ? 'Ulangi (Pilih Aplikasi)' : 'Mulai (Pilih Aplikasi)') : btnLabel}</span>
              </button>
             )
          ) : (
            <Link href={`/dashboard/exams/kerjakan/${exam.id}`} className="group w-full flex items-center justify-between text-sm font-semibold text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors">
              <div className="flex items-center gap-2">
                <Icons.Play />
                <span>{btnLabel}</span>
              </div>
              <Icons.ChevronRight />
            </Link>
          )}
        </div>
      );
    } else if (examEnded && !latestAttemptId) {
      actions.push(
        <div key="ended" className="flex items-center gap-2 text-sm font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed select-none">
          <Icons.Clock />
          <span>{t('exams_badge_ended')}</span>
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        {badge}
        {attemptInfo}
      </div>
      <div className="pt-1">
        {actions}
      </div>
    </div>
  );
};

// --- Exam Card Component ---
const ExamCard = ({ exam, isStudent, formatDate, openModal, categories, onToggleVisibility }) => {
  const { t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

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
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300 flex flex-col overflow-hidden">
      <div className="p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white flex items-start gap-2" title={exam.exam_name}>
          <span className="break-words">{exam.exam_name}</span>
          {exam.exam_is_hidden && <span className="flex-shrink-0 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-700 rounded-full">{t('exams_status_hidden')}</span>}
        </h2>
        {exam.subject_name && (
          <div className="mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {exam.subject_name}
            </span>
          </div>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 min-h-[2.5rem] overflow-hidden line-clamp-2">{exam.description || t('exams_desc_none')}</p>
        <div className="mt-4 flex flex-col gap-2">
          {(exam.start_time || exam.end_time) && (
            <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
              <Icons.Clock />
              <div className="flex flex-col">
                {exam.start_time && <span>{t('exams_label_start')}: {formatDate(exam.start_time)} {new Date(exam.start_time).toLocaleTimeString(t('dash_date_locale'), { hour: '2-digit', minute: '2-digit' })}</span>}
                {exam.end_time && <span>{t('exams_label_end')}: {formatDate(exam.end_time)} {new Date(exam.end_time).toLocaleTimeString(t('dash_date_locale'), { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-auto border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-700/30 rounded-b-2xl">
        {isStudent ? (
          <StudentExamActions exam={exam} />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/dashboard/exams/manage/${exam.id}`} className="group flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 py-2 px-3 rounded-lg transition-colors">
                <Icons.Cog />
                <span>{t('exams_btn_manage')}</span>
              </Link>
              <Link href={`/dashboard/exams/results/${exam.id}`} className="group flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 py-2 px-3 rounded-lg transition-colors">
                <Icons.ChartBar />
                <span>{t('exams_btn_results')}</span>
              </Link>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-600/50 relative group/menu">
              <button onClick={() => openModal('duplicate', exam.id)} className="flex-1 flex items-center justify-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 py-1.5 px-2 rounded-lg transition-colors">
                <Icons.Duplicate />
                <span>{t('exams_btn_duplicate')}</span>
              </button>

              {/* Exam Actions Dropdown Trigger (Moves & Delete) */}
              <div className="flex-1 relative" ref={menuRef}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="w-full flex items-center justify-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 py-1.5 px-2 rounded-lg transition-colors"
                >
                  <Icons.DotsVertical />
                  <span>{t('exams_btn_others')}</span>
                </button>

                {/* Dropdown Menu */}
                <div className={`absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 transition-all origin-bottom-right z-10 ${isMenuOpen ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-95'}`}>
                  <div className="p-1">
                    <button
                      onClick={() => {
                        if (onToggleVisibility) onToggleVisibility();
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
                    >
                      {exam.exam_is_hidden ? <><Icons.Eye /><span>{t('exams_btn_show')}</span></> : <><Icons.EyeOff /><span>{t('exams_btn_hide')}</span></>}
                    </button>
                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-1 mx-2"></div>
                    <button
                      onClick={() => {
                        openModal('moveExam', exam.id, exam.category_id || '');
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
                    >
                      <Icons.Folder />
                      <span>{t('exams_btn_move_category')}</span>
                    </button>
                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-1 mx-2"></div>
                    <button
                      onClick={() => {
                        openModal('delete', exam.id);
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
                    >
                      <Icons.Trash />
                      <span>{t('exams_btn_delete_exam')}</span>
                    </button>
                  </div>
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
const CategoryAccordion = ({ id, name, exams, isOpen, toggleOpen, isStudent, formatDate, openModal, categories, onEdit, onDelete, onToggleVisibility, isHidden, isAdminHidden, onToggleExamVisibility, userRole, userId, categoryCreatedBy, onMove, onDragStart, onDragOver, onDrop, onDragEnd, isDragging }) => {
  const { t } = useLanguage();
  // Hide empty categories for students, and hide empty 'Tanpa Nama' if categories exist
  if (isStudent && exams.length === 0) return null;
  if (id === 'uncategorized' && exams.length === 0 && categories.length > 0) return null;

  const canReorder = !isStudent && (userRole === 'admin' || userId === categoryCreatedBy);

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300 ${isDragging ? 'opacity-40 scale-[0.98] border-indigo-400 border-dashed' : ''}`}
      draggable={canReorder}
      onDragStart={(e) => canReorder && onDragStart && onDragStart(e, id)}
      onDragOver={(e) => canReorder && onDragOver && onDragOver(e, id)}
      onDrop={(e) => canReorder && onDrop && onDrop(e, id)}
      onDragEnd={onDragEnd}
    >
      {/* Accordion Header */}
      <div
        className="w-full flex items-start sm:items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors select-none"
        onClick={toggleOpen}
      >
        <div className="flex items-center gap-3">
          {/* Move Handle - Only for authorized users */}
          {canReorder && id !== 'uncategorized' && (
            <div className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing transition-colors" title="Tahan dan Tarik untuk Mengubah Urutan">
              <Icons.Grip />
            </div>
          )}
          <div className={`p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <Icons.ChevronDown />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex flex-wrap items-center gap-2">
              <span className="break-words">{name}</span>
              <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                {exams.length}
              </span>
              {id !== 'uncategorized' && !isStudent && !!isHidden && (
                <span className="flex-shrink-0 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                  {t('exams_badge_student_hidden')}
                </span>
              )}
              {id !== 'uncategorized' && !isStudent && !!isAdminHidden && (
                <span className="flex-shrink-0 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
                  {t('exams_badge_admin_hidden')}
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* Category Actions (Only show for custom categories, not 'Tanpa Nama', and enforce permissions) */}
        {id !== 'uncategorized' && !isStudent && (userRole === 'admin' || userId === categoryCreatedBy) && (
          <div className="flex flex-shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation() /* Prevent accordion toggle */}>
            {/* Admin Only: Global Hide */}
            {userRole === 'admin' && (
              <button
                onClick={() => onToggleVisibility('admin_hidden')}
                className={`p-2 rounded-lg transition-colors ${isAdminHidden ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : 'text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                title={isAdminHidden ? "Tampilkan untuk Guru & Siswa" : "Sembunyikan dari Guru & Siswa"}
              >
                <Icons.Shield />
              </button>
            )}

            <button
              onClick={() => onToggleVisibility('hidden')}
              className={`p-2 rounded-lg transition-colors ${isHidden ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
              title={isHidden ? "Tampilkan untuk Siswa" : "Sembunyikan dari Siswa"}
            >
              {isHidden ? <Icons.EyeOff /> : <Icons.Eye />}
            </button>
            <button
              onClick={onEdit}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
              title="Ubah Nama"
            >
              <Icons.Cog />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Hapus Kategori"
            >
              <Icons.Trash />
            </button>
          </div>
        )}
      </div>

      {/* Accordion Body */}
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="p-4 sm:p-6 pt-2 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-900/20">
            {exams.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('exams_no_exams')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {exams.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    isStudent={isStudent}
                    formatDate={formatDate}
                    openModal={openModal}
                    categories={categories}
                    onToggleVisibility={() => onToggleExamVisibility(exam.id, exam.exam_is_hidden)}
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
  const { t } = useLanguage();
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

  // Accordion state
  const [openCategories, setOpenCategories] = useState({});

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
    return exams.filter(e =>
      e.exam_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.subject_name && e.subject_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [exams, searchTerm]);

  // Session check and role fetching logic
  // ...
  // [Lines 154-169 unchanged logic, we just need to place new methods above useEffect]
  // ...
  const toggleCategory = (categoryId) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
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
        if (Object.keys(prev).length === 0) {
          const initialOpen = { 'uncategorized': true };
          if (fetchedCategories.length > 0) {
            initialOpen[fetchedCategories[0].id] = true;
          }
          return initialOpen;
        }
        return prev;
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
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(t('dash_date_locale'), options);
  };

  const isStudent = userRole === 'student';

  if (loadingSession || loadingExams) {
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
          {[1, 2, 3].map((i) => (
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

  if (errorExams) {
    return <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-medium text-center">Error: {errorExams}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-tight">
            {isStudent ? t('exams_title_student') : t('exams_title_admin')}
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {t('exams_subtitle_count').replace('{count}', filteredExams.length)}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 max-w-2xl">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Icons.Search />
            </div>
            <input
              type="text"
              placeholder={t('exams_search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium shadow-sm"
            />
          </div>
          {!isStudent && (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => openModal('categoryManage')}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-all border border-slate-200 dark:border-slate-700"
              >
                <Icons.Folder />
                <span className="hidden sm:inline">{t('exams_btn_categories')}</span>
              </button>
              <Link
                href="/dashboard/exams/baru"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 whitespace-nowrap"
              >
                <Icons.Plus />
                <span className="hidden sm:inline">{t('exams_btn_create')}</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {filteredExams.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <Icons.FileText className="block mx-auto w-12 h-12 text-slate-400" />
          <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-white">
            {searchTerm ? t('exams_empty_match') : t('exams_empty_found')}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {searchTerm ? t('exams_empty_adjust') : (isStudent ? t('exams_empty_student') : t('exams_empty_admin'))}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tanpa Nama Category (Uncategorized) */}
          <CategoryAccordion
            id="uncategorized"
            name={t('exams_category_none')}
            exams={filteredExams.filter(e => e.category_id == null)}
            isOpen={openCategories['uncategorized']}
            toggleOpen={() => toggleCategory('uncategorized')}
            isStudent={isStudent}
            formatDate={formatDate}
            openModal={openModal}
            categories={categories}
            isHidden={false}
            isAdminHidden={false}
            onToggleExamVisibility={(id, current) => handleToggleVisibility('exam', id, current)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            isDragging={draggedCategoryId === 'uncategorized'}
            userRole={userRole}
            userId={userId}
          />

          {/* User Created Categories */}
          {categories.map(cat => (
            <CategoryAccordion
              key={cat.id}
              id={cat.id}
              name={cat.name}
              exams={filteredExams.filter(e => e.category_id === cat.id)}
              isOpen={openCategories[cat.id]}
              toggleOpen={() => toggleCategory(cat.id)}
              isStudent={isStudent}
              formatDate={formatDate}
              openModal={openModal}
              categories={categories}
              isHidden={cat.is_hidden}
              isAdminHidden={cat.is_admin_hidden}
              onToggleVisibility={(mode) => handleToggleVisibility('category', cat.id, mode === 'admin_hidden' ? cat.is_admin_hidden : cat.is_hidden, mode)}
              onToggleExamVisibility={(id, current) => handleToggleVisibility('exam', id, current)}
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
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {/* Category List & Create Modal */}
      {modalState.isOpen && modalState.type === 'categoryManage' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <Icons.Folder />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {modalState.categoryId ? 'Ubah Nama Kategori' : 'Kategori Ujian'}
                </h3>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nama Kategori</label>
                <input
                  type="text"
                  value={modalState.categoryName}
                  onChange={(e) => setModalState(prev => ({ ...prev, categoryName: e.target.value }))}
                  placeholder="Masukkan nama kategori baru"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={closeModal} disabled={isExecuting} className="px-4 py-2 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
                  {t('users_btn_cancel')}
                </button>
                <button onClick={executeAction} disabled={!modalState.categoryName.trim() || isExecuting} className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isExecuting && <Icons.Cog className="w-4 h-4 animate-spin" />}
                  <span>{isExecuting ? t('layout_loading') : t('users_btn_save')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Exam Modal */}
      {modalState.isOpen && modalState.type === 'moveExam' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <Icons.Folder />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pindahkan Ujian</h3>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Pilih Kategori Tujuan</label>
                <select
                  value={modalState.categoryId || ''}
                  onChange={(e) => setModalState(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="">{t('exams_category_none')}</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={closeModal} disabled={isExecuting} className="px-4 py-2 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
                  {t('users_btn_cancel')}
                </button>
                <button onClick={executeAction} disabled={isExecuting} className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {isExecuting && <Icons.Cog className="w-4 h-4 animate-spin" />}
                  <span>{isExecuting ? t('layout_loading') : t('exams_modal_move_title')}</span>
                </button>
              </div>
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
        confirmColor="bg-red-600 hover:bg-red-700"
        icon={() => <Icons.Trash className="w-6 h-6" />}
        isExecuting={isExecuting}
      />
      <ConfirmationModal
        isOpen={modalState.isOpen && modalState.type === 'duplicate'}
        onClose={closeModal}
        onConfirm={executeAction}
        title={t('exams_modal_duplicate_title')}
        message={t('exams_modal_duplicate_msg')}
        confirmText={t('exams_btn_duplicate')}
        confirmColor="bg-amber-500 hover:bg-amber-600"
        icon={() => <Icons.Duplicate className="w-6 h-6" />}
        isExecuting={isExecuting}
      />

      <ConfirmationModal
        isOpen={modalState.isOpen && modalState.type === 'delete'}
        onClose={closeModal}
        onConfirm={executeAction}
        title={t('exams_modal_delete_title')}
        message={t('exams_modal_delete_msg')}
        confirmText={t('users_btn_delete')}
        confirmColor="bg-red-600 hover:bg-red-700"
        icon={() => <Icons.Trash className="w-6 h-6" />}
        isExecuting={isExecuting}
      />
    </div>
  );
}

function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmColor = 'bg-indigo-600 hover:bg-indigo-700', icon: Icon, isExecuting = false }) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            {Icon && (
              <div className={`p-3 rounded-full ${confirmColor.includes('red') ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                <Icon className="w-6 h-6" />
              </div>
            )}
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isExecuting}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {t('users_btn_cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={isExecuting}
              className={`px-4 py-2 text-white font-semibold rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 ${confirmColor}`}
            >
              {isExecuting && <Icons.Cog className="w-4 h-4 animate-spin" />}
              <span>{isExecuting ? t('layout_loading') : confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
