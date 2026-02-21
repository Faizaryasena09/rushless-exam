'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/app/components/ThemeProvider';

export default function WebSettingsPage() {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});
    const [message, setMessage] = useState(null);

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
    }, []);

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
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Web Settings</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Kelola pengaturan dan izin untuk setiap role</p>
                </div>
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
                <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-700/50 dark:to-indigo-950/20 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Izin Halaman Profil</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Kontrol fitur yang tersedia di halaman profil untuk setiap role</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {roles.map((role) => {
                        const colors = getRoleColorClasses(role.color);
                        return (
                            <div key={role.key} className={`rounded-xl border ${colors.border} overflow-hidden`}>
                                {/* Role Header */}
                                <div className={`px-5 py-3 ${colors.bg} flex items-center gap-3`}>
                                    <span className="text-lg">{role.icon}</span>
                                    <span className={`text-sm font-bold ${colors.text}`}>{role.label}</span>
                                    <span className={`ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${colors.badge}`}>
                                        {role.key}
                                    </span>
                                </div>

                                {/* Permissions */}
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {permissions.map((perm) => {
                                        const settingKey = `${role.key}_${perm.key}`;
                                        const isEnabled = settings[settingKey] ?? false;
                                        const isSaving = saving[settingKey] ?? false;

                                        return (
                                            <div key={settingKey} className="flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                                <div className="flex-1 min-w-0 mr-4">
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{perm.label}</p>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{perm.description}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleToggle(settingKey)}
                                                    disabled={isSaving}
                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed ${isEnabled ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'
                                                        }`}
                                                    role="switch"
                                                    aria-checked={isEnabled}
                                                >
                                                    <span
                                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'
                                                            }`}
                                                    />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Info Note */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Catatan</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        Pengaturan ini mempengaruhi halaman profil setiap user. Jika fitur dinonaktifkan, form terkait akan
                        ditampilkan dalam kondisi terkunci dengan pesan bahwa fitur telah dinonaktifkan oleh administrator.
                    </p>
                </div>
            </div>
        </div>
    );
}
