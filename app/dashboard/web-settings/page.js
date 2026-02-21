'use client';

import { useState, useEffect } from 'react';

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
            rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700 ring-rose-200' },
            amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700 ring-amber-200' },
            sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-700 ring-sky-200' },
        };
        return map[color] || map.sky;
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
                <div className="h-8 w-48 bg-slate-200 rounded-lg"></div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-2xl p-6 h-40"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Page Title */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl shadow-lg shadow-slate-500/20">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Web Settings</h1>
                    <p className="text-sm text-slate-500">Kelola pengaturan dan izin untuk setiap role</p>
                </div>
            </div>

            {/* Success/Error Message */}
            {message && (
                <div className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
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
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-xl">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Izin Halaman Profil</h2>
                            <p className="text-xs text-slate-500">Kontrol fitur yang tersedia di halaman profil untuk setiap role</p>
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
                                <div className="divide-y divide-slate-100">
                                    {permissions.map((perm) => {
                                        const settingKey = `${role.key}_${perm.key}`;
                                        const isEnabled = settings[settingKey] ?? false;
                                        const isSaving = saving[settingKey] ?? false;

                                        return (
                                            <div key={settingKey} className="flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50/50 transition-colors">
                                                <div className="flex-1 min-w-0 mr-4">
                                                    <p className="text-sm font-semibold text-slate-700">{perm.label}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{perm.description}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleToggle(settingKey)}
                                                    disabled={isSaving}
                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isEnabled ? 'bg-indigo-600' : 'bg-slate-200'
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
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                    <p className="text-sm font-semibold text-amber-800">Catatan</p>
                    <p className="text-xs text-amber-700 mt-1">
                        Pengaturan ini mempengaruhi halaman profil setiap user. Jika fitur dinonaktifkan, form terkait akan
                        ditampilkan dalam kondisi terkunci dengan pesan bahwa fitur telah dinonaktifkan oleh administrator.
                    </p>
                </div>
            </div>
        </div>
    );
}
