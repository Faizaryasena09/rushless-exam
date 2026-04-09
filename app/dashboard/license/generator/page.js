'use client';

import { useState } from 'react';
import { Shield, Key, Download, Trash2, CheckCircle, AlertTriangle, User, Building, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function LicenseGenerator() {
    const [encryptedHwid, setEncryptedHwid] = useState('');
    const [decryptedHwid, setDecryptedHwid] = useState('');
    const [pjName, setPjName] = useState('');
    const [pjEmail, setPjEmail] = useState('');
    const [instansi, setInstansi] = useState('');
    const [kuota, setKuota] = useState('100');
    const [paket, setPaket] = useState('Standard');
    const [expiryDate, setExpiryDate] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDecrypt = () => {
        if (!encryptedHwid.trim()) return toast.error('Please enter the encrypted HWID');
        
        // This is simplified. In a real scenario, decryptHWID might be a server-side action
        // for security, but here we provide it in the tool.
        try {
            // Note: Since this is a client component, decryptHWID needs to be imported carefully.
            // However, crypto module in Node.js might not work in browser directly.
            // Let's assume we'll use an API route for decryption for safety and compatibility.
            fetchDecryptedHwid();
        } catch (error) {
            toast.error('Decryption failed. Check the input format.');
        }
    };

    const fetchDecryptedHwid = async () => {
        try {
            const res = await fetch('/api/license/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'decrypt', data: encryptedHwid })
            });
            const data = await res.json();
            if (data.success) {
                setDecryptedHwid(data.hwid);
                toast.success('HWID Decrypted Successfully');
            } else {
                toast.error(data.message || 'Decryption failed');
            }
        } catch (error) {
            toast.error('Failed to connect to decryption server');
        }
    };

    const handleGenerate = async () => {
        if (!decryptedHwid || !pjName || !pjEmail || !instansi || !kuota || !expiryDate) {
            return toast.error('All fields are required');
        }

        setIsGenerating(true);
        try {
            const res = await fetch('/api/license/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'generate',
                    hwid: decryptedHwid,
                    pj: pjName,
                    emailPj: pjEmail,
                    instansi: instansi,
                    kuota: kuota,
                    paket: paket,
                    expiry: expiryDate
                })
            });
            
            const data = await res.json();
            if (data.success) {
                const blob = new Blob([data.content], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${instansi.replace(/\s+/g, '_')}_license.rhslcs`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                toast.success('License file generated and downloaded!');
            } else {
                toast.error(data.message || 'Generation failed');
            }
        } catch (error) {
            toast.error('Failed to generate license');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                        <Shield className="w-10 h-10 text-rose-600" />
                        Activation Admin Tools
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        Generate official .rhslcs license files for clients.
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* HWID Processing */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 p-8 space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <Key className="w-5 h-5 text-indigo-500" />
                        1. Decrypt Request Code
                    </h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Encrypted Request Code (from User)</label>
                            <textarea
                                value={encryptedHwid}
                                onChange={(e) => setEncryptedHwid(e.target.value)}
                                placeholder="Paste the encrypted code here..."
                                className="w-full h-32 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-xs font-mono"
                            />
                        </div>
                        <button
                            onClick={handleDecrypt}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                            Decrypt HWID
                        </button>

                        {decryptedHwid && (
                            <div className="pt-4 animate-in slide-in-from-top-4 duration-300">
                                <label className="block text-sm font-semibold text-green-600 dark:text-green-400 mb-2">Decrypted HWID</label>
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl font-mono text-sm break-all text-green-800 dark:text-green-300">
                                    {decryptedHwid}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* License Details */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 p-8 space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <Download className="w-5 h-5 text-rose-500" />
                        2. License Configuration
                    </h2>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                    <User className="w-3 h-3" /> Nama PJ
                                </label>
                                <input
                                    type="text"
                                    value={pjName}
                                    onChange={(e) => setPjName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                    <Shield className="w-3 h-3" /> Email PJ
                                </label>
                                <input
                                    type="email"
                                    value={pjEmail}
                                    onChange={(e) => setPjEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                                    placeholder="e.g. john@example.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                    <Building className="w-3 h-3" /> Nama Instansi
                                </label>
                                <input
                                    type="text"
                                    value={instansi}
                                    onChange={(e) => setInstansi(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                                    placeholder="e.g. SMK Negeri 1 Jakarta"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                    <Users className="w-3 h-3" /> Kuota Peserta
                                </label>
                                <input
                                    type="number"
                                    value={kuota}
                                    onChange={(e) => setKuota(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                                    placeholder="Unlimited use -1"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                    <Calendar className="w-3 h-3" /> Expiry Date
                                </label>
                                <input
                                    type="date"
                                    value={expiryDate}
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                <Shield className="w-3 h-3" /> Pilih Paket
                            </label>
                            <select
                                value={paket}
                                onChange={(e) => setPaket(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 appearance-none cursor-pointer"
                            >
                                <option value="Basic">Basic Edition</option>
                                <option value="Pro">Pro Edition</option>
                                <option value="Ultimate">Ultimate Edition</option>
                                <option value="Enterprise">Enterprise Edition</option>
                            </select>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !decryptedHwid}
                            className={`w-full py-4 mt-6 rounded-2xl font-extrabold text-lg transition-all flex items-center justify-center gap-3 ${
                                decryptedHwid 
                                ? 'bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-lg shadow-rose-200 hover:scale-[1.02] active:scale-[0.98]' 
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {isGenerating ? 'Generating...' : (
                                <>
                                    <Download className="w-5 h-5" />
                                    Generate .rhslcs File
                                </>
                            )}
                        </button>
                        {!decryptedHwid && <p className="text-xs text-center text-rose-500 font-medium">Please decrypt the HWID first</p>}
                    </div>
                </div>
            </div>

            {/* Verification Steps Info */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl p-6 flex gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                <div>
                    <h3 className="font-bold text-amber-900 dark:text-amber-200">Security Notice</h3>
                    <p className="text-sm text-amber-800/80 dark:text-amber-300/80 mt-1">
                        Ensure all data is correct before generating. The signature generated is unique to the Hardware ID provided.
                        The client will not be able to activate if the HWID does not match exactly.
                    </p>
                </div>
            </div>
        </div>
    );
}
