'use client';

import { useState, useEffect, useRef } from 'react';
import { Key, Shield, RefreshCw, Cpu, CheckCircle2, XCircle, Clock, Copy, Download, Upload, Info, ExternalLink, Trash2, Lock, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/app/context/LanguageContext';

export default function LicensePage() {
    const { t } = useLanguage();
    const [status, setStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActivating, setIsActivating] = useState(false);
    const [requestCode, setRequestCode] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);
    
    // Deactivation State
    const [showDetachModal, setShowDetachModal] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [isDetaching, setIsDetaching] = useState(false);

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchStatus();

        // Background Heartbeat: Auto-check every 5 minutes
        const interval = setInterval(() => {
            handleRefresh();
        }, 300000); // 5 minutes

        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/license');
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (error) {
            toast.error('Failed to fetch license status');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGetRequestCode = async () => {
        setIsRequesting(true);
        try {
            const res = await fetch('/api/license?action=get-request-code');
            const data = await res.json();
            if (data.success) {
                setRequestCode(data.requestCode);
                toast.success(t('lic_toast_req_success'));
            } else {
                toast.error(t('lic_toast_req_fail'));
            }
        } catch (err) {
            toast.error('Connection error');
        } finally {
            setIsRequesting(false);
        }
    };

    const handleCopyRequestCode = () => {
        navigator.clipboard.writeText(requestCode);
        toast.success('Copied to clipboard');
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target.result;
            try {
                setIsActivating(true);
                const res = await fetch('/api/license', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'upload', content })
                });
                const data = await res.json();
                if (data.success) {
                    toast.success(t('lic_toast_upload_success'));
                    fetchStatus();
                } else {
                    toast.error(data.message || t('lic_toast_upload_fail'));
                }
            } catch (err) {
                toast.error('Failed to upload license');
            } finally {
                setIsActivating(false);
            }
        };
        reader.readAsText(file);
    };

    const handleRefresh = async () => {
        setIsActivating(true);
        try {
            const res = await fetch('/api/license', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check' })
            });
            await fetchStatus();
            toast.success(t('lic_toast_sync_success'));
        } catch (error) {
            toast.error('Failed to refresh status');
        } finally {
            setIsActivating(false);
        }
    };

    const handleDetachLicense = async () => {
        if (!adminPassword) {
            toast.error('Admin password is required');
            return;
        }

        setIsDetaching(true);
        try {
            const res = await fetch('/api/license', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deactivate', password: adminPassword })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(t('lic_toast_detach_success'));
                setShowDetachModal(false);
                setAdminPassword('');
                fetchStatus();
            } else {
                toast.error(data.message || t('lic_toast_detach_fail'));
            }
        } catch (error) {
            toast.error('Error detaching license');
        } finally {
            setIsDetaching(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    const isActive = status?.status === 'active';
    const isPending = status?.status === 'pending';

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-indigo-600" />
                        {t('lic_title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        {t('lic_subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${isActivating ? 'animate-spin' : ''}`} />
                        {t('lic_sync_btn')}
                    </button>
                    {isActive && (
                        <button
                            onClick={() => setShowDetachModal(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-900/30 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            {t('lic_btn_detach')}
                        </button>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Activation Flow Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 p-8">
                        {!isActive ? (
                            <div className="space-y-8">
                                <div className="flex items-center gap-4 text-indigo-600 dark:text-indigo-400">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center font-bold text-xl">1</div>
                                    <h2 className="text-xl font-bold">{t('lic_step_1_title')}</h2>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400">{t('lic_step_1_desc')}</p>
                                
                                {requestCode ? (
                                    <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                                        <div className="relative group">
                                            <textarea
                                                readOnly
                                                value={requestCode}
                                                className="w-full h-32 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                            />
                                            <button
                                                onClick={handleCopyRequestCode}
                                                className="absolute top-2 right-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                                            >
                                                <Copy className="w-4 h-4 text-slate-500" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleGetRequestCode}
                                        disabled={isRequesting}
                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-extrabold text-lg transition-all shadow-lg shadow-indigo-200 dark:shadow-none animate-pulse"
                                    >
                                        {isRequesting ? t('lic_btn_generating') : t('lic_btn_generate_req')}
                                    </button>
                                )}

                                <hr className="border-slate-100 dark:border-slate-700" />

                                <div className="flex items-center gap-4 text-emerald-600 dark:text-emerald-400">
                                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center font-bold text-xl">2</div>
                                    <h2 className="text-xl font-bold">{t('lic_step_2_title')}</h2>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400">{t('lic_step_2_desc')}</p>
                                
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".rhslcs"
                                    className="hidden"
                                />
                                
                                <button
                                    onClick={() => fileInputRef.current.click()}
                                    disabled={isActivating}
                                    className="w-full py-6 border-4 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-3 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all text-slate-400 hover:text-indigo-600 group"
                                >
                                    <Upload className={`w-12 h-12 transition-transform duration-300 ${isActivating ? 'animate-bounce' : 'group-hover:-translate-y-1'}`} />
                                    <span className="font-bold text-lg">{isActivating ? t('lic_verifying') : t('lic_upload_placeholder')}</span>
                                    <span className="text-xs uppercase tracking-widest font-medium opacity-60">{t('lic_upload_sub')}</span>
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div className="flex items-center gap-4 text-emerald-600 dark:text-emerald-400">
                                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black italic tracking-tight">{t('lic_activated_title')}</h2>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('lic_activated_desc')}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">{t('lic_label_pj')}</p>
                                        <p className="font-bold text-slate-800 dark:text-slate-200">{status?.pj || 'Not Specified'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Email PJ</p>
                                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{status?.pj_email || '-'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">{t('lic_label_instansi')}</p>
                                        <p className="font-bold text-slate-800 dark:text-slate-200">{status?.instansi || 'Not Specified'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">{t('lic_label_kuota')}</p>
                                        <p className="font-bold text-slate-800 dark:text-slate-200">{status?.kuota === -1 ? t('lic_unlimited') : `${status?.kuota} ${t('lic_quota_unit')}`}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Paket Sistem</p>
                                        <p className="font-bold text-indigo-600 dark:text-indigo-400">{status?.paket || '-'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">{t('lic_label_expiry')}</p>
                                        <p className="font-bold text-rose-500">
                                            {status?.expiry === 'None' ? 'Selamanya (∞)' : (status?.expiry ? (() => {
                                                const d = new Date(status.expiry);
                                                return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                                            })() : '-')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info & Sidebar */}
                <div className="space-y-6">
                    <div className={`bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border p-8 transition-all relative overflow-hidden ${
                        isActive ? 'border-emerald-100 dark:border-emerald-900/50' : 
                        isPending ? 'border-amber-100 dark:border-amber-900/50' : 
                        'border-rose-100 dark:border-rose-900/50'
                    }`}>
                        {isActive && <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />}
                        
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                            <Info className="w-4 h-4" />
                            {t('lic_status_current')}
                        </h3>
                        
                        <div className="flex items-center gap-4 mb-8">
                            {isActive ? (
                                <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-200/50 dark:shadow-none">
                                    <CheckCircle2 className="w-10 h-10" />
                                </div>
                            ) : isPending ? (
                                <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500">
                                    <Clock className="w-10 h-10" />
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-500 shadow-lg shadow-rose-200/50 dark:shadow-none">
                                    <XCircle className="w-10 h-10" />
                                </div>
                            )}
                            <div>
                                <p className={`text-3xl font-black tracking-tight uppercase ${
                                    isActive ? 'text-emerald-600' : isPending ? 'text-amber-600' : 'text-rose-600'
                                }`}>
                                    {isActive ? t('lic_status_active') : t('lic_status_inactive')}
                                </p>
                                <p className="text-xs font-bold text-slate-400 mt-1 italic opacity-60">{t('lic_last_sync')} {status?.last_check ? new Date(status.last_check).toLocaleTimeString() : t('lic_never')}</p>
                            </div>
                        </div>

                        {isActive && (
                            <div className="pt-8 border-t border-slate-100 dark:border-slate-700 animate-in fade-in duration-700">
                                <p className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-tight">{t('lic_label_expiry')}</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-5xl font-black text-slate-900 dark:text-white leading-none">
                                        {status?.days_left === -1 ? '∞' : status?.days_left}
                                    </p>
                                    <p className="text-xl font-bold text-slate-400 uppercase tracking-tighter">{t('lic_days_left')}</p>
                                </div>
                                <div className="mt-6 w-full h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-1000 ease-out shadow-sm"
                                        style={{ width: status?.days_left === -1 ? '100%' : `${Math.min(100, (status.days_left / 365) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-700 mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                            <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-3 h-3" />
                                {t('lic_server_status')}
                            </p>
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full animate-pulse ${
                                    status?.server_status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 
                                    status?.server_status === 'revoked' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' :
                                    'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                                }`} />
                                <p className={`text-sm font-bold ${
                                    status?.server_status === 'online' ? 'text-emerald-600' : 
                                    status?.server_status === 'revoked' ? 'text-rose-600' :
                                    'text-amber-600'
                                }`}>
                                    {status?.server_status === 'online' ? t('lic_server_online') : 
                                     status?.server_status === 'revoked' ? t('lic_server_revoked') :
                                     t('lic_server_offline')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detach License Modal */}
            {showDetachModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-8 space-y-6 transform animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 text-rose-600">
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold">{t('lic_detach_modal_title')}</h3>
                        </div>
                        
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            {t('lic_detach_modal_desc')}
                        </p>

                        <div className="space-y-4 pt-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                                {t('lic_detach_confirm_label')}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="password"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <button
                                onClick={() => {
                                    setShowDetachModal(false);
                                    setAdminPassword('');
                                }}
                                className="flex-1 px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                {t('questions_btn_cancel')}
                            </button>
                            <button
                                onClick={handleDetachLicense}
                                disabled={isDetaching || !adminPassword}
                                className="flex-1 px-6 py-3 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-rose-200 dark:shadow-none"
                            >
                                {isDetaching ? t('lic_verifying') : t('lic_detach_btn_confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
