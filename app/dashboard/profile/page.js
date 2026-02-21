'use client';

import { useState, useEffect } from 'react';

export default function ProfilePage() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState({ can_change_password: true, can_change_username: true });

    // Password form
    const [currentPasswordPw, setCurrentPasswordPw] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwLoading, setPwLoading] = useState(false);
    const [pwMessage, setPwMessage] = useState(null);

    // Username form
    const [currentPasswordUn, setCurrentPasswordUn] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [unLoading, setUnLoading] = useState(false);
    const [unMessage, setUnMessage] = useState(null);

    // Show/hide password toggles
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);
    const [showCurrentPwUn, setShowCurrentPwUn] = useState(false);

    useEffect(() => {
        fetchProfile();
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        try {
            const res = await fetch('/api/web-settings?mode=my-permissions');
            if (res.ok) {
                const data = await res.json();
                setPermissions(data);
            }
        } catch (err) {
            console.error('Failed to fetch permissions:', err);
        }
    };

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/profile');
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
            }
        } catch (err) {
            console.error('Failed to fetch profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwMessage(null);
        setPwLoading(true);

        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'change-password',
                    currentPassword: currentPasswordPw,
                    newPassword,
                    confirmPassword,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setPwMessage({ type: 'success', text: data.message });
                setCurrentPasswordPw('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setPwMessage({ type: 'error', text: data.message });
            }
        } catch {
            setPwMessage({ type: 'error', text: 'Terjadi kesalahan.' });
        } finally {
            setPwLoading(false);
        }
    };

    const handleChangeUsername = async (e) => {
        e.preventDefault();
        setUnMessage(null);
        setUnLoading(true);

        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'change-username',
                    currentPassword: currentPasswordUn,
                    newUsername,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setUnMessage({ type: 'success', text: data.message });
                setCurrentPasswordUn('');
                setNewUsername('');
                fetchProfile();
            } else {
                setUnMessage({ type: 'error', text: data.message });
            }
        } catch {
            setUnMessage({ type: 'error', text: 'Terjadi kesalahan.' });
        } finally {
            setUnLoading(false);
        }
    };

    const getInitials = (name) => name ? name.charAt(0).toUpperCase() : 'U';

    const getRoleBadge = (role) => {
        const styles = {
            admin: 'bg-rose-100 text-rose-700 ring-rose-200',
            teacher: 'bg-amber-100 text-amber-700 ring-amber-200',
            student: 'bg-sky-100 text-sky-700 ring-sky-200',
        };
        return styles[role] || 'bg-gray-100 text-gray-700 ring-gray-200';
    };

    const EyeIcon = () => (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
    );

    const EyeOffIcon = () => (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 014.302-5.374M9.88 9.88a3 3 0 104.24 4.24" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
        </svg>
    );

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
                <div className="h-8 w-48 bg-slate-200 rounded-lg"></div>
                <div className="bg-white rounded-2xl p-8 h-48"></div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl p-8 h-72"></div>
                    <div className="bg-white rounded-2xl p-8 h-72"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Page Title */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Profil Saya</h1>
                    <p className="text-sm text-slate-500">Kelola informasi akun Anda</p>
                </div>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                <div className="px-6 pb-6 -mt-12">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[3px] shadow-xl shadow-purple-500/20">
                            <div className="h-full w-full rounded-[13px] bg-white flex items-center justify-center">
                                <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-purple-600">
                                    {getInitials(profile?.name || profile?.username)}
                                </span>
                            </div>
                        </div>
                        <div className="flex-1 pb-1">
                            <h2 className="text-xl font-bold text-slate-900">{profile?.name || profile?.username}</h2>
                            <p className="text-sm text-slate-500">@{profile?.username}</p>
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${getRoleBadge(profile?.role)}`}>
                                {profile?.role?.charAt(0).toUpperCase() + profile?.role?.slice(1)}
                            </span>
                            {profile?.class_name && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
                                    {profile.class_name}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Username</p>
                                <p className="text-sm font-semibold text-slate-700">{profile?.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Role</p>
                                <p className="text-sm font-semibold text-slate-700 capitalize">{profile?.role}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="p-2 bg-pink-100 rounded-lg">
                                <svg className="w-4 h-4 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Bergabung</p>
                                <p className="text-sm font-semibold text-slate-700">
                                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Forms Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Change Password */}
                <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                    {!permissions.can_change_password && (
                        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-6">
                            <div className="p-3 bg-slate-100 rounded-full mb-3">
                                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <p className="text-sm font-semibold text-slate-600 text-center">Fitur Dinonaktifkan</p>
                            <p className="text-xs text-slate-400 text-center mt-1">Ganti password telah dinonaktifkan oleh administrator.</p>
                        </div>
                    )}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-100 rounded-xl">
                            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Ganti Password</h3>
                            <p className="text-xs text-slate-500">Pastikan password baru kuat dan mudah diingat</p>
                        </div>
                    </div>

                    {pwMessage && (
                        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${pwMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                            {pwMessage.type === 'success' ? (
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            )}
                            {pwMessage.text}
                        </div>
                    )}

                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password Saat Ini</label>
                            <div className="relative">
                                <input
                                    type={showCurrentPw ? 'text' : 'password'}
                                    value={currentPasswordPw}
                                    onChange={(e) => setCurrentPasswordPw(e.target.value)}
                                    className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="Masukkan password saat ini"
                                    required
                                />
                                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                    {showCurrentPw ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password Baru</label>
                            <div className="relative">
                                <input
                                    type={showNewPw ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="Masukkan password baru"
                                    required
                                />
                                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                    {showNewPw ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Konfirmasi Password Baru</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPw ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="Ulangi password baru"
                                    required
                                />
                                <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                    {showConfirmPw ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={pwLoading}
                            className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-sm rounded-xl shadow-sm shadow-amber-500/20 hover:shadow-md hover:shadow-amber-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {pwLoading ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Ubah Password
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Change Username */}
                <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                    {!permissions.can_change_username && (
                        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-6">
                            <div className="p-3 bg-slate-100 rounded-full mb-3">
                                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <p className="text-sm font-semibold text-slate-600 text-center">Fitur Dinonaktifkan</p>
                            <p className="text-xs text-slate-400 text-center mt-1">Ganti username telah dinonaktifkan oleh administrator.</p>
                        </div>
                    )}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-100 rounded-xl">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Ganti Username</h3>
                            <p className="text-xs text-slate-500">Username digunakan untuk login ke akun Anda</p>
                        </div>
                    </div>

                    {unMessage && (
                        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${unMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                            {unMessage.type === 'success' ? (
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            )}
                            {unMessage.text}
                        </div>
                    )}

                    <form onSubmit={handleChangeUsername} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Username Saat Ini</label>
                            <input
                                type="text"
                                value={profile?.username || ''}
                                disabled
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Username Baru</label>
                            <input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                placeholder="Masukkan username baru"
                                required
                                minLength={3}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password (Konfirmasi)</label>
                            <div className="relative">
                                <input
                                    type={showCurrentPwUn ? 'text' : 'password'}
                                    value={currentPasswordUn}
                                    onChange={(e) => setCurrentPasswordUn(e.target.value)}
                                    className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="Masukkan password untuk konfirmasi"
                                    required
                                />
                                <button type="button" onClick={() => setShowCurrentPwUn(!showCurrentPwUn)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                    {showCurrentPwUn ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={unLoading}
                            className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-sm rounded-xl shadow-sm shadow-indigo-500/20 hover:shadow-md hover:shadow-indigo-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {unLoading ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Ubah Username
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
