'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/app/components/ThemeProvider';
import Link from 'next/link';

export default function WebSettingsPage() {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});
    const [message, setMessage] = useState(null);
    const [lockedUsers, setLockedUsers] = useState([]);
    const [unlocking, setUnlocking] = useState({});

    const roles = [
        { key: 'admin', label: 'Admin', color: 'rose', icon: '🛡️' },
        { key: 'teacher', label: 'Teacher', color: 'amber', icon: '📚' },
        { key: 'student', label: 'Student', color: 'sky', icon: '🎓' },
    ];

    const permissions = [
        { key: 'can_change_password', label: 'Ganti Password', description: 'Izinkan role ini untuk mengubah password mereka di halaman profil' },
        { key: 'can_change_username', label: 'Ganti Username', description: 'Izinkan role ini untuk mengubah username mereka di halaman profil' },
    ];

    useEffect(() => {
        fetchSettings();
        fetchLockedUsers();
    }, []);

    const fetchLockedUsers = async () => {
        try {
            const res = await fetch('/api/locked-users');
            if (res.ok) {
                const data = await res.json();
                setLockedUsers(data.users || []);
            }
        } catch (err) {
            console.error('Failed to fetch locked users:', err);
        }
    };

    const handleUnlock = async (userId, username) => {
        setUnlocking(prev => ({ ...prev, [userId]: true }));
        try {
            const res = await fetch('/api/locked-users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            if (res.ok) {
                setMessage({ type: 'success', text: `User ${username} berhasil di-unlock.` });
                setTimeout(() => setMessage(null), 3000);
                fetchLockedUsers();
            } else {
                setMessage({ type: 'error', text: 'Gagal unlock user.' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Terjadi kesalahan.' });
        } finally {
            setUnlocking(prev => ({ ...prev, [userId]: false }));
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/web-settings');
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (settingKey) => {
        const newValue = !settings[settingKey];
        setSaving(prev => ({ ...prev, [settingKey]: true }));
        setMessage(null);

        try {
            const res = await fetch('/api/web-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: settingKey, value: newValue }),
            });

            if (res.ok) {
                setSettings(prev => ({ ...prev, [settingKey]: newValue }));
                setMessage({ type: 'success', text: 'Pengaturan berhasil disimpan.' });
                setTimeout(() => setMessage(null), 3000);
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.message || 'Gagal menyimpan pengaturan.' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Terjadi kesalahan.' });
        } finally {
            setSaving(prev => ({ ...prev, [settingKey]: false }));
        }
    };

    const getRoleColorClasses = (color) => {
        const map = {
            rose: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-400', badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800' },
            amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800' },
            sky: { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', text: 'text-sky-700 dark:text-sky-400', badge: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800' },
        };
        return map[color] || map.sky;
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
                <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-6 h-40"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Page Title */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-slate-600 to-slate-800 dark:from-slate-700 dark:to-slate-900 rounded-xl shadow-lg shadow-slate-500/20">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Tools</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Pengaturan, monitoring, dan manajemen sistem</p>
                </div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link href="/dashboard/system-overview" className="group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 dark:from-indigo-500/10 dark:to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-start gap-4">
                        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">System Overview</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Monitoring CPU, memory, bandwidth, dan informasi server secara real-time</p>
                        </div>
                        <svg className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </Link>

                <Link href="/dashboard/database" className="group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-600 transition-all duration-300 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-500/10 dark:to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-start gap-4">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Database</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Kelola tabel, backup data, dan lihat statistik database</p>
                        </div>
                        <svg className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </Link>

                <Link href="/dashboard/activity-logs" className="group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-600 transition-all duration-300 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 dark:from-amber-500/10 dark:to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-start gap-4">
                        <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Activity Logs</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Monitor aktivitas user, login, dan system events secara detail</p>
                        </div>
                        <svg className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-amber-500 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </Link>
            </div>

            {/* Success/Error Message */}
            {message && (
                <div className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${message.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    }`}>
                    {message.type === 'success' ? (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                    {message.text}
                </div>
            )}

            {/* Profile Permissions Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-700/50 dark:to-indigo-950/20 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                        <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Izin Halaman Profil</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Kontrol fitur profil per role</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700">
                                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-3">Permission</th>
                                {roles.map(role => (
                                    <th key={role.key} className="text-center text-xs font-semibold px-4 py-3 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1.5 ${getRoleColorClasses(role.color).text}`}>
                                            <span>{role.icon}</span>
                                            <span>{role.label}</span>
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {permissions.map((perm, idx) => (
                                <tr key={perm.key} className={`border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-700/20'}`}>
                                    <td className="px-5 py-3">
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{perm.label}</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">{perm.description}</p>
                                    </td>
                                    {roles.map(role => {
                                        const settingKey = `${role.key}_${perm.key}`;
                                        const isEnabled = settings[settingKey] ?? false;
                                        const isSaving = saving[settingKey] ?? false;
                                        return (
                                            <td key={settingKey} className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleToggle(settingKey)}
                                                    disabled={isSaving}
                                                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed ${isEnabled ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                    role="switch"
                                                    aria-checked={isEnabled}
                                                >
                                                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Brute Force Protection Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-red-50/30 dark:from-slate-700/50 dark:to-red-950/20 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                    <div className="p-1.5 bg-red-100 dark:bg-red-900/40 rounded-lg">
                        <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Brute Force Protection</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Kunci akun otomatis setelah login gagal berulang</p>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    {/* Max Attempts */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Maksimal Percobaan Gagal</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Akun terkunci setelah jumlah ini terlampaui</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={settings.bruteforce_max_attempts ?? 5}
                                onChange={(e) => setSettings(prev => ({ ...prev, bruteforce_max_attempts: parseInt(e.target.value) || 1 }))}
                                className="w-20 px-3 py-1.5 text-sm text-center border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-400 dark:text-slate-500">kali</span>
                            <button
                                onClick={async () => {
                                    setSaving(prev => ({ ...prev, bruteforce_max_attempts: true }));
                                    try {
                                        const res = await fetch('/api/web-settings', {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ key: 'bruteforce_max_attempts', value: settings.bruteforce_max_attempts ?? 5 }),
                                        });
                                        if (res.ok) {
                                            setMessage({ type: 'success', text: 'Batas percobaan login berhasil disimpan.' });
                                            setTimeout(() => setMessage(null), 3000);
                                        } else {
                                            const d = await res.json();
                                            setMessage({ type: 'error', text: d.message || 'Gagal menyimpan.' });
                                        }
                                    } catch { setMessage({ type: 'error', text: 'Terjadi kesalahan.' }); }
                                    finally { setSaving(prev => ({ ...prev, bruteforce_max_attempts: false })); }
                                }}
                                disabled={saving.bruteforce_max_attempts}
                                className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {saving.bruteforce_max_attempts ? '...' : 'Simpan'}
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700/50" />

                    {/* Lockout Duration */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Durasi Penguncian</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Berapa lama akun terkunci otomatis</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="1"
                                max="1440"
                                value={settings.bruteforce_lockout_minutes ?? 15}
                                onChange={(e) => setSettings(prev => ({ ...prev, bruteforce_lockout_minutes: parseInt(e.target.value) || 1 }))}
                                className="w-20 px-3 py-1.5 text-sm text-center border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-400 dark:text-slate-500">menit</span>
                            <button
                                onClick={async () => {
                                    setSaving(prev => ({ ...prev, bruteforce_lockout_minutes: true }));
                                    try {
                                        const res = await fetch('/api/web-settings', {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ key: 'bruteforce_lockout_minutes', value: settings.bruteforce_lockout_minutes ?? 15 }),
                                        });
                                        if (res.ok) {
                                            setMessage({ type: 'success', text: 'Durasi penguncian berhasil disimpan.' });
                                            setTimeout(() => setMessage(null), 3000);
                                        } else {
                                            const d = await res.json();
                                            setMessage({ type: 'error', text: d.message || 'Gagal menyimpan.' });
                                        }
                                    } catch { setMessage({ type: 'error', text: 'Terjadi kesalahan.' }); }
                                    finally { setSaving(prev => ({ ...prev, bruteforce_lockout_minutes: false })); }
                                }}
                                disabled={saving.bruteforce_lockout_minutes}
                                className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {saving.bruteforce_lockout_minutes ? '...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Locked Users List */}
                {lockedUsers.length > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-700">
                        <div className="px-5 py-3 bg-red-50/50 dark:bg-red-950/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                </span>
                                <span className="text-xs font-semibold text-red-600 dark:text-red-400">{lockedUsers.length} user terkunci / punya percobaan gagal</span>
                            </div>
                            <button onClick={fetchLockedUsers} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                ↻ Refresh
                            </button>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {lockedUsers.map(u => (
                                <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${u.isCurrentlyLocked
                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                            }`}>
                                            {u.isCurrentlyLocked ? '🔒' : '⚠️'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                                {u.name || u.username}
                                                <span className="ml-1.5 text-xs font-normal text-slate-400">@{u.username}</span>
                                            </p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                                {u.failedAttempts} gagal
                                                {u.isCurrentlyLocked && u.lockedUntil && (
                                                    <span className="ml-1 text-red-500 dark:text-red-400 font-medium">
                                                        · Terkunci sampai {new Date(u.lockedUntil).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                                    </span>
                                                )}
                                                {!u.isCurrentlyLocked && u.failedAttempts > 0 && (
                                                    <span className="ml-1 text-amber-500"> · Belum terkunci</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUnlock(u.id, u.username)}
                                        disabled={unlocking[u.id]}
                                        className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {unlocking[u.id] ? '...' : '🔓 Unlock'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Info Note */}
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Fitur yang dinonaktifkan akan terkunci di halaman profil user.
            </p>
        </div>
    );
}
