'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, User as UserIcon, Lock, LogIn, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useLanguage } from '@/app/context/LanguageContext';

const LOCKOUT_TOAST_ID = 'login-lockout';

function LoginForm() {
  const { t } = useLanguage();
  const [branding, setBranding] = useState({ site_name: 'Rushless Exam', site_logo: '/favicon.ico' });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const [lockoutEndTs, setLockoutEndTs] = useState(null);
  const [lockoutMessage, setLockoutMessage] = useState('');

  useEffect(() => {
    if (!lockoutEndTs) return;
    const updateCountdown = () => {
      const diff = lockoutEndTs - Math.floor(Date.now() / 1000);
      if (diff <= 0) {
        toast.dismiss(LOCKOUT_TOAST_ID);
        setLockoutEndTs(null);
        setLockoutMessage('');
        return;
      }
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      toast.error(lockoutMessage, {
        id: LOCKOUT_TOAST_ID,
        duration: Infinity,
        description: `${t('login_retry_in')} ${m}m ${s}s`,
      });
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockoutEndTs, lockoutMessage]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/user-session');
        if (res.ok) {
          const data = await res.json();
          if (data.user) router.push(redirectTo);
        }
      } catch (error) {
        console.error('Failed to check session:', error);
      }
    };
    checkSession();

    const fetchBranding = async () => {
      try {
        const res = await fetch('/api/web-settings?mode=branding');
        if (res.ok) {
          const data = await res.json();
          setBranding(data);
          if (data.site_name) {
            document.title = data.site_name.replace(/<[^>]*>?/gm, '').trim() || 'Rushless Exam';
          }
        }
      } catch (e) { console.error(e); }
    };
    fetchBranding();
  }, [router, redirectTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    toast.dismiss();
    setIsLoading(true);
    let handledByLockoutToast = false;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const message = data.message || 'Something went wrong';
        if (res.status === 429 && data.locked_until_ts) {
          handledByLockoutToast = true;
          setLockoutMessage(message);
          setLockoutEndTs(data.locked_until_ts);
        } else {
          setLockoutEndTs(null);
          setLockoutMessage('');
          toast.error(message);
        }
        throw new Error(message);
      }

      toast.success(t('login_success'));

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          Object.keys(localStorage)
            .filter(k => k.startsWith('exam_instructions_ack_'))
            .forEach(k => localStorage.removeItem(k));
        }
        router.push(redirectTo);
      }, 1000);
    } catch (error) {
      if (!handledByLockoutToast) toast.error(error.message);
      setIsLoading(false);
    }
  };

  const disabled = isLoading || lockoutEndTs !== null;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-5 py-10 overflow-hidden">
      {/* Latar halus - warna blob dibuat lebih dalam supaya halaman ini punya
          warna yang sama dengan halaman lain, bukan abu-abu. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="rl-grid absolute inset-0 opacity-40 dark:opacity-25" />
        <div className="rl-blob h-80 w-80 bg-indigo-500/50 dark:bg-indigo-700/35 -top-24 -left-24" />
        <div className="rl-blob h-96 w-96 bg-emerald-400/45 dark:bg-emerald-800/25 -bottom-32 -right-24" style={{ animationDelay: '-8s' }} />
        <div className="rl-blob h-72 w-72 bg-violet-400/35 dark:bg-violet-800/20 top-1/3 right-0" style={{ animationDelay: '-16s' }} />
      </div>

      {/* Kartu */}
      <div className="rl-animate-card relative w-full max-w-[460px]">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 shadow-2xl shadow-slate-900/10 dark:shadow-black/50 overflow-hidden">
          {/* Strip gradien di atas - penanda identitas aplikasi, konsisten dengan
              header halaman lain. */}
          <div aria-hidden className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />

          <div className="px-8 pt-8 pb-7 text-center">
            <div className="flex justify-center mb-4">
              <span className="rl-float grid place-items-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 border border-indigo-200 dark:border-indigo-900/60 overflow-hidden">
                <img src={branding.site_logo} alt="Logo" className="h-9 w-9 object-contain" />
              </span>
            </div>
            <h1
              className="text-xl font-bold text-slate-900 dark:text-white truncate"
              dangerouslySetInnerHTML={{ __html: branding.site_name }}
            />
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-8 -mt-2 space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">{t('login_username_label')}</label>
              <div className="relative">
                <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder={t('login_username_label')}
                  aria-label={t('login_username_label')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={disabled}
                  suppressHydrationWarning
                  className="w-full pl-10 pr-3 py-3 text-[15px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/20 transition-colors disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">{t('login_password_label')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('login_password_label')}
                  aria-label={t('login_password_label')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={disabled}
                  suppressHydrationWarning
                  className="w-full pl-10 pr-11 py-3 text-[15px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/20 transition-colors disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={disabled}
              suppressHydrationWarning
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-[15px] font-bold rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-300/60 dark:shadow-indigo-950/50 hover:bg-indigo-700 transition-all disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <LoaderCircle size={17} className="animate-spin" />
                  {t('login_btn_loading')}
                </>
              ) : (
                <>
                  <LogIn size={17} />
                  {t('login_btn')}
                </>
              )}
            </button>
          </form>

          <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30">
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="grid place-items-center w-4 h-4 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={10} />
              </span>
              {t('login_secure_note')}
            </p>
          </div>
        </div>
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-500 dark:text-slate-400 shadow-sm">
          <span className="grid place-items-center w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <LoaderCircle size={12} className="animate-spin" />
          </span>
          Loading...
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}