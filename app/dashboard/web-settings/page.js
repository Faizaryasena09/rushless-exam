'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/app/components/ThemeProvider';
import { useLanguage } from '@/app/context/LanguageContext';
import Link from 'next/link';
import Cropper from 'react-easy-crop';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Palette, Languages, Smartphone, UserCog, ShieldAlert, RotateCcw, Monitor, FileText, Users, FolderArchive, Save, LoaderCircle, ChevronRight, X, Info, Lock, LockOpen, TriangleAlert, KeyRound, ImagePlus, RefreshCw, Clock } from 'lucide-react';
import { getSupportedTimezones, DEFAULT_TIMEZONE, formatClock } from '@/app/lib/timezone';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

export default function WebSettingsPage() {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});
    const [lockedUsers, setLockedUsers] = useState([]);
    const [unlocking, setUnlocking] = useState({});
    const [unlockingAll, setUnlockingAll] = useState(false);
    const { t, lang, setLang, timezone: appTimezone, setTimezone: setAppTimezone, fmt, dateLocale } = useLanguage();
    const [selectedLang, setSelectedLang] = useState(lang);
    const [langSaving, setLangSaving] = useState(false);
    const [selectedTimezone, setSelectedTimezone] = useState(appTimezone || DEFAULT_TIMEZONE);
    const [tzSaving, setTzSaving] = useState(false);
    const [resetUnlocking, setResetUnlocking] = useState(false);

    // Daftar zona waktu diambil dari runtime (Intl) supaya selalu sesuai dengan
    // data IANA yang didukung Node/browser versi ini.
    //
    // Penting: daftar ini bisa berbeda antara Node (SSR) dan browser (client),
    // sehingga selalu diurutkan agar urutan <option> sama dan tidak terjadi
    // hydration mismatch.
    const TIMEZONE_OPTIONS = useMemo(() => {
        const list = getSupportedTimezones().slice().sort();
        return list.map(value => ({
            value,
            label: value.replace(/_/g, ' '),
        }));
    }, []);

    // Ikuti perubahan timezone dari luar (mis. setelah simpan) supaya preview akurat.
    useEffect(() => {
        setSelectedTimezone(appTimezone || DEFAULT_TIMEZONE);
    }, [appTimezone]);

    const handleTimezoneSave = async () => {
        setTzSaving(true);
        try {
            const res = await fetch('/api/web-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'app_timezone', value: selectedTimezone }),
            });
            if (res.ok) {
                // Terapkan langsung tanpa reload supaya seluruh halaman ikut berubah.
                setAppTimezone(selectedTimezone);
                setSettings(prev => ({ ...prev, app_timezone: selectedTimezone }));
                toast.success(t('admin_tz_success'));
            } else {
                const d = await res.json();
                toast.error(d.message || t('admin_error_settings_save'));
            }
        } catch {
            toast.error(t('admin_generic_error'));
        } finally {
            setTzSaving(false);
        }
    };

    // Cropper State
    const [cropImage, setCropImage] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const roles = [
        { key: 'admin', label: t('users_role_admin'), color: 'rose', icon: '🛡️' },
        { key: 'teacher', label: t('users_role_teacher'), color: 'amber', icon: '📚' },
        { key: 'student', label: t('users_role_student'), color: 'sky', icon: '🎓' },
    ];

    const permissions = [
        { key: 'can_change_password', label: t('admin_permissions_pass_title'), description: t('admin_permissions_pass_desc') },
        { key: 'can_change_username', label: t('admin_permissions_user_title'), description: t('admin_permissions_user_desc') },
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

    const handleUnlockReset = async () => {
        setResetUnlocking(true);
        try {
            const res = await fetch('/api/web-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'unlock_session_reset' }),
            });
            if (res.ok) {
                toast.success(t('admin_session_reset_unlock_success'));
            } else {
                toast.error(t('admin_session_reset_unlock_error'));
            }
        } catch {
            toast.error(t('admin_generic_error'));
        } finally {
            setResetUnlocking(false);
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
                toast.success(t('admin_success_unlock_user').replace('{username}', username));
                fetchLockedUsers();
            } else {
                toast.error(t('admin_error_unlock_user'));
            }
        } catch {
            toast.error(t('admin_generic_error'));
        } finally {
            setUnlocking(prev => ({ ...prev, [userId]: false }));
        }
    };

    const handleUnlockAll = async () => {
        if (!window.confirm(t('admin_bruteforce_unlock_all_confirm'))) return;
        
        setUnlockingAll(true);
        try {
            const res = await fetch('/api/locked-users', { method: 'DELETE' });
            if (res.ok) {
                toast.success(t('admin_bruteforce_unlock_all_success'));
                fetchLockedUsers();
            } else {
                toast.error(t('admin_generic_error'));
            }
        } catch { toast.error(t('admin_generic_error')); }
        finally { setUnlockingAll(false); }
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
                toast.success(t('admin_success_lang_save'));
            } else {
                const d = await res.json();
                toast.error(d.message || t('admin_error_lang_save'));
            }
        } catch {
            toast.error(t('admin_generic_error'));
        } finally {
            setLangSaving(false);
        }
    };

    const handleToggle = async (settingKey) => {
        const newValue = !settings[settingKey];
        setSaving(prev => ({ ...prev, [settingKey]: true }));
        try {
            const res = await fetch('/api/web-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: settingKey, value: newValue }),
            });

            if (res.ok) {
                setSettings(prev => ({ ...prev, [settingKey]: newValue }));
                toast.success(t('admin_success_settings_save'));
            } else {
                const data = await res.json();
                toast.error(data.message || t('admin_error_settings_save'));
            }
        } catch {
            toast.error(t('admin_generic_error'));
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
                toast.success(t('admin_success_logo_save'));
            } else {
                const d = await res.json();
                toast.error(d.message || t('admin_error_logo_save'));
            }
        } catch (err) {
            console.error(err);
            toast.error(t('admin_error_image_process'));
        } finally {
            setSaving(prev => ({ ...prev, site_logo: false }));
        }
    };

    if (loading) {
        return (
            <div className="space-y-5">
                <div className="h-7 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                {[0, 1, 2].map(i => (
                    <div key={i} className="h-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
                ))}
            </div>
        );
    }

return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('admin_title')}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {t('admin_subtitle')} Setiap bagian punya tombol simpan sendiri.
                </p>
            </div>

            {/* Navigasi section */}
            <nav className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-slate-50 dark:bg-slate-950/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
                <div className="flex gap-1.5 overflow-x-auto">
                    {SETTINGS_SECTIONS.map(s => (
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

            {/* Shortcut ke halaman admin lain */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <QuickLink href="/dashboard/system-overview" icon={<Monitor size={16} />} title={t('admin_nav_overview')} desc={t('admin_nav_overview_desc')} />
                <QuickLink href="/dashboard/activity-logs" icon={<FileText size={16} />} title={t('admin_nav_logs')} desc={t('admin_nav_logs_desc')} />
                <QuickLink href="/dashboard/session-control" icon={<Users size={16} />} title={t('admin_nav_session')} desc={t('admin_nav_session_desc')} />
                <QuickLink href="/dashboard/archive-answers" icon={<FolderArchive size={16} />} title={t('admin_nav_archive')} desc={t('admin_nav_archive_desc')} />
            </div>

            {/* Identitas Website */}
            <SettingsSection id="branding" icon={<Palette size={16} />} title={t('admin_branding_title')} desc={t('admin_branding_desc')}>
                <SettingRow
                    label={t('admin_branding_site_name_label')}
                    desc={t('admin_branding_site_name_desc')}
                    control={(
                        <SaveButton
                            saving={saving.site_name}
                            onClick={async () => {
                                setSaving(prev => ({ ...prev, site_name: true }));
                                try {
                                    const res = await fetch('/api/web-settings', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ key: 'site_name', value: settings.site_name || 'Rushless Exam' }),
                                    });
                                    if (res.ok) {
                                        toast.success(t('admin_success_settings_save'));
                                    } else {
                                        const d = await res.json();
                                        toast.error(d.message || t('admin_error_settings_save'));
                                    }
                                } catch { toast.error(t('admin_generic_error')); }
                                finally { setSaving(prev => ({ ...prev, site_name: false })); }
                            }}
                            label={t('admin_branding_name_btn')}
                        />
                    )}
                >
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                        <JoditEditor
                            value={settings.site_name || ''}
                            onBlur={(newContent) => setSettings(prev => ({ ...prev, site_name: newContent }))}
                            config={{
                                readonly: saving.site_name,
                                toolbarInline: true,
                                theme: 'default',
                                hidePoweredByJodit: true,
                                placeholder: t('admin_branding_name_placeholder'),
                            }}
                        />
                    </div>
                </SettingRow>

                <div className="h-px bg-slate-100 dark:border-slate-800" />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="sm:max-w-xs">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('admin_branding_logo_title')}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('admin_branding_logo_desc')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {settings.site_logo && (
                            <div className="w-16 h-16 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-1.5">
                                <img src={settings.site_logo} alt="Logo saat ini" className="max-w-full max-h-full object-contain" />
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                id="logoInput"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        const reader = new FileReader();
                                        reader.onload = () => setCropImage(reader.result);
                                        reader.readAsDataURL(e.target.files[0]);
                                        e.target.value = '';
                                    }
                                }}
                            />
                            <button
                                onClick={() => document.getElementById('logoInput').click()}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <ImagePlus size={15} />
                                {settings.site_logo ? 'Ganti Logo' : t('admin_branding_logo_btn')}
                            </button>
                            {saving.site_logo && (
                                <span className="text-xs text-slate-500 animate-pulse">{t('admin_branding_logo_saving')}</span>
                            )}
                        </div>
                    </div>
                </div>
            </SettingsSection>

            {/* Bahasa */}
            <SettingsSection id="language" icon={<Languages size={16} />} title={t('admin_lang_title')} desc={t('admin_lang_desc')}>
                <SettingRow
                    label={t('admin_lang_label')}
                    desc={t('admin_lang_info')}
                    control={(
                        <SaveButton
                            saving={langSaving}
                            onClick={handleLanguageSave}
                            label={t('users_btn_save')}
                        />
                    )}
                >
                    <div className="inline-flex p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                        {[
                            { key: 'id', label: 'Indo', flag: '🇮🇩' },
                            { key: 'en', label: 'English', flag: '🇺🇸' }
                        ].map(l => (
                            <button
                                key={l.key}
                                onClick={() => setSelectedLang(l.key)}
                                aria-pressed={selectedLang === l.key}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${selectedLang === l.key
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                                <span>{l.flag}</span>
                                {l.label}
                            </button>
                        ))}
                    </div>
                </SettingRow>
            </SettingsSection>

            {/* Zona Waktu */}
            <SettingsSection id="timezone" icon={<Clock size={16} />} title={t('admin_tz_title')} desc={t('admin_tz_desc')}>
                <SettingRow
                    label={t('admin_tz_label')}
                    desc={t('admin_tz_desc')}
                    control={(
                        <SaveButton
                            saving={tzSaving}
                            onClick={handleTimezoneSave}
                            label={t('users_btn_save')}
                        />
                    )}
                >
                    <div className="space-y-2">
                        <select
                            value={selectedTimezone}
                            onChange={(e) => setSelectedTimezone(e.target.value)}
                            aria-label={t('admin_tz_label')}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 transition-colors"
                        >
                            {TIMEZONE_OPTIONS.map(tz => (
                                <option key={tz.value} value={tz.value}>
                                    {tz.label}
                                </option>
                            ))}
                        </select>

                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <Info size={13} className="shrink-0" />
                            <span>
                                {t('admin_tz_preview')}{' '}
                                <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                                    {/* Pratinjau memakai zona yang sedang dipilih, bukan
                                        zona aktif, jadi admin bisa langsung melihat
                                        efek sekalian perubahan. */}
                                    {formatClock(new Date(), { locale: dateLocale, timeZone: selectedTimezone })}
                                </span>
                            </span>
                        </div>
                    </div>
                </SettingRow>
            </SettingsSection>

            {/* Konfigurasi Android */}
            <SettingsSection id="android" icon={<Smartphone size={16} />} title={t('admin_android_title')} desc={t('admin_android_desc')}>
                <SettingRow
                    label={t('admin_android_emergency_label')}
                    desc={t('admin_android_emergency_desc')}
                    control={(
                        <SaveButton
                            saving={saving.app_emergency_password}
                            onClick={async () => {
                                const key = 'app_emergency_password';
                                setSaving(prev => ({ ...prev, [key]: true }));
                                try {
                                    const res = await fetch('/api/web-settings', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ key, value: settings[key] }),
                                    });
                                    if (res.ok) {
                                        toast.success(t('admin_android_success_save'));
                                    } else {
                                        const d = await res.json();
                                        toast.error(d.message || t('admin_error_settings_save'));
                                    }
                                } catch { toast.error(t('admin_generic_error')); }
                                finally { setSaving(prev => ({ ...prev, [key]: false })); }
                            }}
                            label={t('users_btn_save')}
                        />
                    )}
                >
                    <input
                        type="text"
                        placeholder={t('admin_android_emergency_placeholder')}
                        value={settings.app_emergency_password || ''}
                        onChange={(e) => setSettings(prev => ({ ...prev, app_emergency_password: e.target.value }))}
                        aria-label={t('admin_android_emergency_label')}
                        className="w-full sm:w-64 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
                    />
                </SettingRow>
            </SettingsSection>

            {/* Hak Akses */}
            <SettingsSection
                id="permissions"
                icon={<UserCog size={16} />}
                title={t('admin_permissions_title')}
                desc={t('admin_permissions_desc')}
                action={(
                    <div className="flex flex-wrap items-center gap-2">
                        {roles.map(role => {
                            const enabled = permissions.filter(p => settings[`${role.key}_${p.key}`]).length;
                            return (
                                <span key={role.key} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                    {role.icon} {role.label}: {enabled}/{permissions.length}
                                </span>
                            );
                        })}
                    </div>
                )}
            >
                {/* Desktop: tabel permission */}
                <div className="hidden md:block overflow-x-auto -mx-4 px-4">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800">
                                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2.5">Permission</th>
                                {roles.map(role => (
                                    <th key={role.key} className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-3 py-2.5 whitespace-nowrap">
                                        {role.icon} {role.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {permissions.map(perm => (
                                <tr key={perm.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-3 py-3">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{perm.label}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{perm.description}</p>
                                    </td>
                                    {roles.map(role => {
                                        const settingKey = `${role.key}_${perm.key}`;
                                        const isEnabled = settings[settingKey] ?? false;
                                        const isSaving = saving[settingKey] ?? false;
                                        return (
                                            <td key={settingKey} className="px-3 py-3 text-center">
                                                <ToggleSwitch
                                                    checked={isEnabled}
                                                    disabled={isSaving}
                                                    label={`${role.label} - ${perm.label}`}
                                                    onChange={() => handleToggle(settingKey)}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile: kartu permission */}
                <div className="md:hidden space-y-3">
                    {permissions.map(perm => (
                        <div key={perm.key} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{perm.label}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">{perm.description}</p>
                            <div className="grid grid-cols-3 gap-2">
                                {roles.map(role => {
                                    const settingKey = `${role.key}_${perm.key}`;
                                    const isEnabled = settings[settingKey] ?? false;
                                    const isSaving = saving[settingKey] ?? false;
                                    return (
                                        <button
                                            key={settingKey}
                                            onClick={() => !isSaving && handleToggle(settingKey)}
                                            disabled={isSaving}
                                            className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border transition-colors disabled:opacity-60 ${isEnabled
                                                ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                                        >
                                            <span className="text-base leading-none">{role.icon}</span>
                                            <span className="text-[11px] font-semibold">{role.label}</span>
                                            <span className={`text-[10px] ${isEnabled ? 'opacity-70' : 'text-slate-400'}`}>
                                                {isEnabled ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Perubahan pada tabel permission langsung tersimpan saat toggle diklik.
                </p>
            </SettingsSection>

            {/* Keamanan Login */}
            <SettingsSection id="security" icon={<ShieldAlert size={16} />} title={t('admin_bruteforce_title')} desc={t('admin_bruteforce_desc')}>
                <SettingRow
                    label={t('admin_bruteforce_max_label')}
                    desc={t('admin_bruteforce_max_desc')}
                    control={<NumberFieldControl
                        value={settings.bruteforce_max_attempts ?? 5}
                        min={1}
                        max={50}
                        unit="Kali"
                        onChange={(v) => setSettings(prev => ({ ...prev, bruteforce_max_attempts: v }))}
                        onSave={async () => {
                            const key = 'bruteforce_max_attempts';
                            setSaving(prev => ({ ...prev, [key]: true }));
                            try {
                                const res = await fetch('/api/web-settings', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ key, value: settings[key] ?? 5 }),
                                });
                                if (res.ok) toast.success(t('admin_bruteforce_success_save'));
                                else toast.error((await res.json()).message || t('admin_error_settings_save'));
                            } catch { toast.error(t('admin_generic_error')); }
                            finally { setSaving(prev => ({ ...prev, [key]: false })); }
                        }}
                        saving={saving.bruteforce_max_attempts}
                        saveLabel={t('users_btn_save')}
                    />}
                />

                <div className="h-px bg-slate-100 dark:bg-slate-800" />

                <SettingRow
                    label={t('admin_bruteforce_lockout_label')}
                    desc={t('admin_bruteforce_lockout_desc')}
                    control={<NumberFieldControl
                        value={settings.bruteforce_lockout_minutes ?? 15}
                        min={1}
                        max={1440}
                        unit="Menit"
                        onChange={(v) => setSettings(prev => ({ ...prev, bruteforce_lockout_minutes: v }))}
                        onSave={async () => {
                            const key = 'bruteforce_lockout_minutes';
                            setSaving(prev => ({ ...prev, [key]: true }));
                            try {
                                const res = await fetch('/api/web-settings', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ key, value: settings[key] ?? 15 }),
                                });
                                if (res.ok) toast.success(t('admin_bruteforce_lockout_success_save'));
                                else toast.error((await res.json()).message || t('admin_error_settings_save'));
                            } catch { toast.error(t('admin_generic_error')); }
                            finally { setSaving(prev => ({ ...prev, [key]: false })); }
                        }}
                        saving={saving.bruteforce_lockout_minutes}
                        saveLabel={t('users_btn_save')}
                    />}
                />

                {/* Aksi darurat */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 px-4 py-3">
                    <div className="flex items-start gap-2.5">
                        <TriangleAlert size={16} className="shrink-0 mt-0.5 text-red-500" />
                        <div>
                            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Buka Kunci Semua Login</p>
                            <p className="text-xs text-red-600/80 dark:text-red-300/70">
                                Membuka paksa seluruh akun yang terkunci karena gagal login berulang.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleUnlockAll}
                        disabled={unlockingAll}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 shrink-0"
                    >
                        {unlockingAll ? <LoaderCircle size={14} className="animate-spin" /> : <LockOpen size={14} />}
                        {unlockingAll ? 'Membuka...' : t('admin_bruteforce_btn_unlock_all')}
                    </button>
                </div>

                {/* Daftar user terkunci */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {lockedUsers.length > 0
                                ? t('admin_bruteforce_locked_count').replace('{count}', lockedUsers.length)
                                : 'Tidak ada akun terkunci'}
                        </p>
                        <button
                            onClick={fetchLockedUsers}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                        >
                            <RefreshCw size={12} />
                            {t('admin_bruteforce_refresh')}
                        </button>
                    </div>

                    {lockedUsers.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                            Semua akun bisa login seperti biasa.
                        </p>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {lockedUsers.map(u => (
                                <div key={u.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${u.isCurrentlyLocked
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                                            {u.isCurrentlyLocked ? <Lock size={14} /> : <TriangleAlert size={14} />}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                                {u.name || u.username}
                                                <span className="ml-1.5 text-xs font-normal text-slate-400">@{u.username}</span>
                                            </p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {u.failedAttempts} {t('admin_bruteforce_failed_suffix')}
                                                {u.isCurrentlyLocked && u.lockedUntil && (
                                                    <span className="ml-1 text-red-500 dark:text-red-400 font-medium">
                                                        · {t('admin_bruteforce_locked_until')} {fmt.dateTime(u.lockedUntil)}
                                                    </span>
                                                )}
                                                {!u.isCurrentlyLocked && u.failedAttempts > 0 && (
                                                    <span className="ml-1 text-amber-500"> · {t('admin_bruteforce_not_locked')}</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUnlock(u.id, u.username)}
                                        disabled={unlocking[u.id]}
                                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                    >
                                        {unlocking[u.id] ? <LoaderCircle size={13} className="animate-spin" /> : <LockOpen size={13} />}
                                        {t('admin_btn_unlock')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </SettingsSection>

            {/* Reset Sesi */}
            <SettingsSection id="session-reset" icon={<RotateCcw size={16} />} title={t('admin_session_reset_title')} desc={t('admin_session_reset_desc')}>
                <SettingRow
                    label={t('admin_session_reset_max_title')}
                    desc={t('admin_session_reset_max_desc')}
                    control={<NumberFieldControl
                        value={settings.reset_max_attempts ?? 3}
                        min={1}
                        max={50}
                        unit={t('admin_bruteforce_unit_times')}
                        onChange={(v) => setSettings(prev => ({ ...prev, reset_max_attempts: v }))}
                        onSave={async () => {
                            const key = 'reset_max_attempts';
                            setSaving(prev => ({ ...prev, [key]: true }));
                            try {
                                const res = await fetch('/api/web-settings', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ key, value: settings[key] ?? 3 }),
                                });
                                if (res.ok) toast.success(t('admin_session_reset_max_success'));
                                else toast.error((await res.json()).message || t('admin_error_settings_save'));
                            } catch { toast.error(t('admin_generic_error')); }
                            finally { setSaving(prev => ({ ...prev, [key]: false })); }
                        }}
                        saving={saving.reset_max_attempts}
                        saveLabel={t('users_btn_save')}
                    />}
                />

                <div className="h-px bg-slate-100 dark:bg-slate-800" />

                <SettingRow
                    label={t('admin_session_reset_lock_title')}
                    desc={t('admin_session_reset_lock_desc')}
                    control={<NumberFieldControl
                        value={settings.reset_lockout_minutes ?? 15}
                        min={1}
                        max={1440}
                        unit={t('admin_bruteforce_unit_minutes')}
                        onChange={(v) => setSettings(prev => ({ ...prev, reset_lockout_minutes: v }))}
                        onSave={async () => {
                            const key = 'reset_lockout_minutes';
                            setSaving(prev => ({ ...prev, [key]: true }));
                            try {
                                const res = await fetch('/api/web-settings', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ key, value: settings[key] ?? 15 }),
                                });
                                if (res.ok) toast.success(t('admin_session_reset_lock_success'));
                                else toast.error((await res.json()).message || t('admin_error_settings_save'));
                            } catch { toast.error(t('admin_generic_error')); }
                            finally { setSaving(prev => ({ ...prev, [key]: false })); }
                        }}
                        saving={saving.reset_lockout_minutes}
                        saveLabel={t('users_btn_save')}
                    />}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
                    <div className="flex items-start gap-2.5">
                        <KeyRound size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{t('admin_session_reset_unlock_title')}</p>
                            <p className="text-xs text-amber-700/80 dark:text-amber-300/70">{t('admin_session_reset_unlock_desc')}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleUnlockReset}
                        disabled={resetUnlocking}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50 shrink-0"
                    >
                        {resetUnlocking ? <LoaderCircle size={14} className="animate-spin" /> : <LockOpen size={14} />}
                        {resetUnlocking ? 'Membuka...' : t('admin_btn_unlock')}
                    </button>
                </div>
            </SettingsSection>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-start gap-1.5">
                <Info size={13} className="shrink-0 mt-0.5" />
                {t('admin_footer_info')}
            </p>

            {/* Modal crop logo */}
            {cropImage && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-0 sm:p-6" onClick={() => setCropImage(null)}>
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="w-full sm:max-w-lg h-full sm:h-auto bg-white dark:bg-slate-900 sm:rounded-2xl shadow-xl overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('admin_modal_crop_title')}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Logo akan dipotong otomatis menjadi rasio 1:1.</p>
                            </div>
                            <button
                                onClick={() => setCropImage(null)}
                                aria-label="Tutup"
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="relative flex-1 min-h-[280px] w-full bg-slate-900">
                            <Cropper
                                image={cropImage}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>

                        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
                            <label className="flex items-center gap-3 flex-1">
                                <span className="text-xs font-semibold text-slate-500 shrink-0">Zoom</span>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    aria-label="Zoom"
                                    onChange={(e) => setZoom(e.target.value)}
                                    className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-slate-900 dark:accent-white"
                                />
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCropImage(null)}
                                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    {t('admin_modal_crop_cancel')}
                                </button>
                                <button
                                    onClick={handleCropSave}
                                    disabled={saving.site_logo}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {saving.site_logo && <LoaderCircle size={14} className="animate-spin" />}
                                    {t('admin_modal_crop_save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const SETTINGS_SECTIONS = [
    { id: 'branding', label: 'Identitas Website' },
    { id: 'language', label: 'Bahasa' },
    { id: 'timezone', label: 'Zona Waktu' },
    { id: 'android', label: 'Android' },
    { id: 'permissions', label: 'Hak Akses' },
    { id: 'security', label: 'Keamanan Login' },
    { id: 'session-reset', label: 'Reset Sesi' }
];

function SettingsSection({ id, icon, title, desc, children, action }) {
    return (
        <section id={id} className="scroll-mt-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        {icon}
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                    </div>
                </div>
                {action}
            </div>
            <div className="p-4 space-y-4">{children}</div>
        </section>
    );
}

function SettingRow({ label, desc, control, children }) {
    return (
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div className="lg:max-w-xs">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto lg:justify-end">
                <div className="min-w-0">{children}</div>
                {control}
            </div>
        </div>
    );
}

function SaveButton({ onClick, saving, label }) {
    return (
        <button
            onClick={onClick}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
            {saving ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Menyimpan' : label}
        </button>
    );
}

function NumberFieldControl({ value, onChange, onSave, saving, min, max, unit, saveLabel }) {
    return (
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <input
                    type="number"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
                    aria-label={unit}
                    className="w-14 bg-transparent text-sm font-semibold text-slate-900 dark:text-white outline-none"
                />
                <span className="text-[11px] font-semibold text-slate-400 uppercase">{unit}</span>
            </div>
            <SaveButton onClick={onSave} saving={saving} label={saveLabel} />
        </div>
    );
}

function ToggleSwitch({ checked, onChange, disabled, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={onChange}
            disabled={disabled}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
            <span className={`pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
        </button>
    );
}

function QuickLink({ href, icon, title, desc }) {
    return (
        <Link
            href={href}
            className="group flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
            <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-800 dark:text-white">{title}</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{desc}</span>
            </span>
            <ChevronRight size={14} className="shrink-0 text-slate-300 dark:text-slate-600 mt-1 group-hover:text-slate-500" />
        </Link>
    );
}
