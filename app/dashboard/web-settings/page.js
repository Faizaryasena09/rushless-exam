'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/app/components/ThemeProvider';
import { useLanguage } from '@/app/context/LanguageContext';
import Link from 'next/link';
import Cropper from 'react-easy-crop';
import dynamic from 'next/dynamic';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

export default function WebSettingsPage() {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});
    const [message, setMessage] = useState(null);
    const [lockedUsers, setLockedUsers] = useState([]);
    const [unlocking, setUnlocking] = useState({});
    const { lang, setLang } = useLanguage();
    const [selectedLang, setSelectedLang] = useState(lang);
    const [langSaving, setLangSaving] = useState(false);

    // Cropper State
    const [cropImage, setCropImage] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

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
                if (data.app_language) setSelectedLang(data.app_language);
            }
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLanguageSave = async () => {
        setLangSaving(true);
        try {
            const res = await fetch('/api/web-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'app_language', value: selectedLang }),
            });
            if (res.ok) {
                setLang(selectedLang); // update context immediately
                setMessage({ type: 'success', text: selectedLang === 'id' ? 'Bahasa berhasil disimpan.' : 'Language saved successfully.' });
                setTimeout(() => setMessage(null), 3000);
            } else {
                const d = await res.json();
                setMessage({ type: 'error', text: d.message || 'Gagal menyimpan bahasa.' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Terjadi kesalahan.' });
        } finally {
            setLangSaving(false);
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

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCropSave = async () => {
        if (!cropImage || !croppedAreaPixels) return;
        setSaving(prev => ({ ...prev, site_logo: true }));
        try {
            // Create a canvas to crop the image
            const canvas = document.createElement('canvas');
            const image = new Image();
            image.src = cropImage;
            await new Promise(resolve => image.onload = resolve);

            canvas.width = croppedAreaPixels.width;
            canvas.height = croppedAreaPixels.height;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(
                image,
                croppedAreaPixels.x,
                croppedAreaPixels.y,
                croppedAreaPixels.width,
                croppedAreaPixels.height,
                0,
                0,
                croppedAreaPixels.width,
                croppedAreaPixels.height
            );

            // Convert canvas to base64
            const base64Image = canvas.toDataURL('image/png', 0.9);

            const res = await fetch('/api/web-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'site_logo', value: base64Image }),
            });

            if (res.ok) {
                setSettings(prev => ({ ...prev, site_logo: base64Image }));
                setCropImage(null); // Close modal
                setMessage({ type: 'success', text: 'Logo situs berhasil diperbarui.' });
                setTimeout(() => setMessage(null), 3000);
            } else {
                const d = await res.json();
                setMessage({ type: 'error', text: d.message || 'Gagal menyimpan logo.' });
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Terjadi kesalahan saat memproses gambar.' });
        } finally {
            setSaving(prev => ({ ...prev, site_logo: false }));
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

            {/* Site Branding Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50/30 dark:from-slate-700/50 dark:to-blue-950/20 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Site Branding</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Atur logo dan nama unik situs web Anda</p>
                    </div>
                </div>
                <div className="p-5 space-y-6">
                    {/* Site Name Input */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="md:max-w-xs">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Nama Situs (Site Name)</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Akan ditampilkan di header, sidebar, judul dokumen, dsb.</p>
                        </div>
                        <div className="flex flex-col gap-3 w-full md:w-[65%]">
                            <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden prose-sm bg-white dark:bg-slate-700 min-h-[100px]">
                                <JoditEditor
                                    value={settings.site_name || ''}
                                    onBlur={newContent => setSettings(prev => ({ ...prev, site_name: newContent }))}
                                    config={{
                                        readonly: saving.site_name,
                                        toolbarInline: true,
                                        theme: 'default',
                                        placeholder: 'Mendukung format HTML...',
                                    }}
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={async () => {
                                        setSaving(prev => ({ ...prev, site_name: true }));
                                        try {
                                            const res = await fetch('/api/web-settings', {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ key: 'site_name', value: settings.site_name || 'Rushless Exam' }),
                                            });
                                            if (res.ok) {
                                                setMessage({ type: 'success', text: 'Nama situs berhasil disimpan.' });
                                                setTimeout(() => setMessage(null), 3000);
                                            } else {
                                                const d = await res.json();
                                                setMessage({ type: 'error', text: d.message || 'Gagal menyimpan.' });
                                            }
                                        } catch { setMessage({ type: 'error', text: 'Terjadi kesalahan.' }); }
                                        finally { setSaving(prev => ({ ...prev, site_name: false })); }
                                    }}
                                    disabled={saving.site_name}
                                    className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50"
                                >
                                    {saving.site_name ? 'Menyimpan...' : 'Simpan Nama Situs'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700/50" />

                    {/* Site Logo Uploader Placeholder */}
                    <div className="flex flex-col sm:flex-row justify-between gap-5">
                        <div className="flex-1">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Upload Logo Situs</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 cursor-pointer hover:underline" onClick={() => document.getElementById('logoInput').click()}>
                                Upload logo baru berformat PNG/JPG dan potong secara presisi dengan Cropper. Disarankan aspek rasio 1:1.
                            </p>
                            <input 
                                type="file" 
                                id="logoInput" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                    if(e.target.files && e.target.files.length > 0) {
                                        const reader = new FileReader();
                                        reader.onload = () => setCropImage(reader.result);
                                        reader.readAsDataURL(e.target.files[0]);
                                        e.target.value = ''; // Reset
                                    }
                                }} 
                            />
                            <button
                                onClick={() => document.getElementById('logoInput').click()}
                                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-lg text-sm font-semibold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                            >
                                Pilih Gambar
                            </button>
                            {saving.site_logo && <span className="ml-3 text-xs text-slate-500 animate-pulse">Menyimpan...</span>}
                        </div>
                        {settings.site_logo && (
                            <div className="flex-shrink-0 flex flex-col items-center">
                                <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Logo Saat Ini</p>
                                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden p-2 shadow-inner">
                                    <img src={settings.site_logo} alt="Current Site Logo" className="max-w-full max-h-full object-contain" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Language Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-violet-50/30 dark:from-slate-700/50 dark:to-violet-950/20 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                    <div className="p-1.5 bg-violet-100 dark:bg-violet-900/40 rounded-lg">
                        <svg className="w-4 h-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Bahasa / Language</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Pilih bahasa antarmuka aplikasi</p>
                    </div>
                </div>
                <div className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Bahasa Antarmuka</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Berlaku untuk semua halaman kecuali konten soal ujian.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex w-full sm:w-auto rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 shadow-sm">
                                <button
                                    onClick={() => setSelectedLang('id')}
                                    className={`flex-1 sm:flex-none px-4 py-2.5 text-sm font-bold transition-all ${
                                        selectedLang === 'id'
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    🇮🇩 Indo
                                </button>
                                <button
                                    onClick={() => setSelectedLang('en')}
                                    className={`flex-1 sm:flex-none px-4 py-2.5 text-sm font-bold transition-all border-l border-slate-200 dark:border-slate-600 ${
                                        selectedLang === 'en'
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    🇺🇸 English
                                </button>
                            </div>
                            <button
                                onClick={handleLanguageSave}
                                disabled={langSaving}
                                className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-lg shadow-violet-100 dark:shadow-none transition-all disabled:opacity-50"
                            >
                                {langSaving ? '...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

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

                <div className="overflow-x-hidden md:overflow-x-auto">
                    {/* Desktop Table */}
                    <table className="w-full hidden md:table">
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

                    {/* Mobile Card List */}
                    <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
                        {permissions.map(perm => (
                            <div key={perm.key} className="p-5 space-y-4">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{perm.label}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{perm.description}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {roles.map(role => {
                                        const settingKey = `${role.key}_${perm.key}`;
                                        const isEnabled = settings[settingKey] ?? false;
                                        const isSaving = saving[settingKey] ?? false;
                                        const color = getRoleColorClasses(role.color);
                                        return (
                                            <div 
                                                key={settingKey} 
                                                onClick={() => !isSaving && handleToggle(settingKey)}
                                                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                                                    isEnabled 
                                                        ? `${color.bg} ${color.border}` 
                                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 opacity-60'
                                                }`}
                                            >
                                                <span className="text-lg mb-1">{role.icon}</span>
                                                <span className={`text-[10px] font-bold uppercase tracking-tighter ${isEnabled ? color.text : 'text-slate-400'}`}>
                                                    {role.label}
                                                </span>
                                                <div className={`mt-2 w-full h-1 rounded-full ${isEnabled ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                                    {isSaving && <div className="h-full bg-indigo-400 animate-pulse rounded-full" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
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
                    {/* Max Attempts */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="md:max-w-xs">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Maksimal Percobaan Gagal</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Akun terkunci setelah jumlah ini terlampaui</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={settings.bruteforce_max_attempts ?? 5}
                                    onChange={(e) => setSettings(prev => ({ ...prev, bruteforce_max_attempts: parseInt(e.target.value) || 1 }))}
                                    className="w-16 bg-transparent text-center font-bold text-slate-900 dark:text-white outline-none"
                                />
                                <span className="text-xs font-bold text-slate-400 uppercase">Kali</span>
                            </div>
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
                                className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50"
                            >
                                {saving.bruteforce_max_attempts ? '...' : 'Simpan'}
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700/50" />

                    {/* Lockout Duration */}
                    {/* Lockout Duration */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="md:max-w-xs">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Durasi Penguncian</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Berapa lama akun terkunci otomatis</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                <input
                                    type="number"
                                    min="1"
                                    max="1440"
                                    value={settings.bruteforce_lockout_minutes ?? 15}
                                    onChange={(e) => setSettings(prev => ({ ...prev, bruteforce_lockout_minutes: parseInt(e.target.value) || 1 }))}
                                    className="w-16 bg-transparent text-center font-bold text-slate-900 dark:text-white outline-none"
                                />
                                <span className="text-xs font-bold text-slate-400 uppercase">Menit</span>
                            </div>
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
                                className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50"
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

            {/* Cropper Modal */}
            {cropImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col h-[80vh] sm:h-auto">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 dark:text-white">Potong Logo Situs</h3>
                            <button onClick={() => setCropImage(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="relative flex-1 min-h-[300px] w-full bg-slate-900">
                            <Cropper
                                image={cropImage}
                                crop={crop}
                                zoom={zoom}
                                aspect={1} // 1:1 Aspect Ratio recommended for logos
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <div className="mb-4 flex items-center gap-3">
                                <span className="text-xs font-medium text-slate-500">Zoom</span>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    aria-labelledby="Zoom"
                                    onChange={(e) => setZoom(e.target.value)}
                                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-600"
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setCropImage(null)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleCropSave}
                                    disabled={saving.site_logo}
                                    className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50"
                                >
                                    {saving.site_logo ? 'Menyimpan...' : 'Terapkan Logo'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
