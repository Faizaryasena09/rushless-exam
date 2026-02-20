'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Globe, ScrollText, AlertTriangle, CheckCircle2, XCircle, Mail, UserCheck } from 'lucide-react';

export default function TermsPage() {
    const [lang, setLang] = useState('en'); // 'en' or 'id'

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-700">
            {/* Navigation Bar */}
            <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-colors group">
                            <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-indigo-50 transition-colors">
                                <ChevronLeft className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-sm">Back to Home</span>
                        </Link>

                        <button
                            onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium transition-colors border border-indigo-100"
                        >
                            <Globe className="w-4 h-4" />
                            <span>{lang === 'en' ? 'Bahasa Indonesia' : 'English'}</span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="pb-20">
                {/* Hero Section */}
                <div className="bg-gradient-to-b from-indigo-50 via-white to-white pt-16 pb-12 px-4 text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-indigo-100 text-indigo-600 rounded-2xl mb-6 shadow-sm ring-4 ring-white">
                        <ScrollText className="w-10 h-10" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
                        {lang === 'en' ? 'Terms of Service' : 'Syarat dan Ketentuan'}
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        {lang === 'en'
                            ? 'Please read these terms carefully before using our platform. Your agreement ensures a safe and rightful environment for everyone.'
                            : 'Mohon baca syarat ini dengan saksama. Persetujuan Anda memastikan lingkungan yang aman dan adil bagi semua pengguna.'}
                    </p>
                    <div className="mt-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-medium uppercase tracking-wider">
                        {lang === 'en' ? 'Effective Date: Feb 20, 2026' : 'Tanggal Berlaku: 20 Feb 2026'}
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                    {lang === 'en' ? (
                        <EnglishContent />
                    ) : (
                        <IndonesianContent />
                    )}
                </div>
            </main>

            <footer className="py-12 bg-white border-t border-slate-200">
                <div className="text-center">
                    <p className="text-slate-500 text-sm">
                        &copy; {new Date().getFullYear()} Rushless Exam. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}

const EnglishContent = () => (
    <div className="space-y-6">
        {/* Agreement */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-2">1. Agreement to Terms</h2>
            <p className="text-slate-600 leading-relaxed">
                By accessing or using the Rushless Exam platform, you agree to be bound by these Terms of Service.
                If you do not agree to these terms, please do not use our services.
            </p>
        </section>

        {/* Permissions & Restrictions - Warning Style */}
        <section className="bg-amber-50/50 p-8 rounded-2xl border border-amber-100 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-amber-900 mb-4">2. Usage Permissions & Restrictions</h2>
                    <div className="space-y-4">
                        <div className="bg-white/80 p-4 rounded-xl border border-amber-200/50">
                            <h3 className="flex items-center gap-2 font-bold text-amber-800 mb-2">
                                <Mail className="w-4 h-4" /> Permission Required
                            </h3>
                            <p className="text-amber-900/80 text-sm">
                                This application may be used by anyone, provided they have obtained permission.
                                To request usage permissions, please send an email to <a href="mailto:cenax09@gmail.com" className="font-bold underline text-amber-900 hover:text-amber-700">cenax09@gmail.com</a>.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                <h3 className="flex items-center gap-2 font-bold text-rose-700 mb-2">
                                    <XCircle className="w-4 h-4" /> No Code Modification
                                </h3>
                                <p className="text-rose-900/70 text-sm">
                                    Although open source, you are <strong>strictly prohibited</strong> from modifying internal code without permission.
                                </p>
                            </div>
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                <h3 className="flex items-center gap-2 font-bold text-rose-700 mb-2">
                                    <XCircle className="w-4 h-4" /> No Commercial Use
                                </h3>
                                <p className="text-rose-900/70 text-sm">
                                    Strictly <strong>not for resale</strong>. Intended solely for educational purposes.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Personal Use */}
        <section className="bg-indigo-50/50 p-8 rounded-2xl border border-indigo-100 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                    <UserCheck className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-indigo-900 mb-2">3. Personal Use</h2>
                    <p className="text-indigo-800/80 leading-relaxed">
                        For individual or personal use, the rules are less strict, provided the core principles of non-commercialization and credit to the original creator are maintained.
                    </p>
                </div>
            </div>
        </section>

        {/* Standard Clauses */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">4. Standard Guidelines</h2>
            <div className="space-y-6">
                <div>
                    <h3 className="font-bold text-slate-800 mb-1">Acceptable Use</h3>
                    <p className="text-slate-600 text-sm">You agree to use this platform only for lawful educational purposes. No cheating, no bypassing security.</p>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 mb-1">Academic Integrity</h3>
                    <p className="text-slate-600 text-sm">Rushless Exam reinforces academic integrity. Dishonesty may result in disciplinary action.</p>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 mb-1">Disclaimer</h3>
                    <p className="text-slate-600 text-sm">Provided "as is" without warranties. We strive for high availability but do not guarantee error-free operation.</p>
                </div>
            </div>
        </section>
    </div>
);

const IndonesianContent = () => (
    <div className="space-y-6">
        {/* Agreement */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-2">1. Persetujuan Syarat</h2>
            <p className="text-slate-600 leading-relaxed">
                Dengan mengakses atau menggunakan platform Rushless Exam, Anda menyetujui syarat-syarat ini.
                Jika Anda tidak setuju, mohon jangan gunakan layanan kami.
            </p>
        </section>

        {/* Permissions & Restrictions - Warning Style */}
        <section className="bg-amber-50/50 p-8 rounded-2xl border border-amber-100 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-amber-900 mb-4">2. Izin Penggunaan & Batasan</h2>
                    <div className="space-y-4">
                        <div className="bg-white/80 p-4 rounded-xl border border-amber-200/50">
                            <h3 className="flex items-center gap-2 font-bold text-amber-800 mb-2">
                                <Mail className="w-4 h-4" /> Izin Diperlukan
                            </h3>
                            <p className="text-amber-900/80 text-sm">
                                Aplikasi ini boleh digunakan siapa saja dengan izin.
                                Untuk meminta izin, silakan kirim email ke <a href="mailto:cenax09@gmail.com" className="font-bold underline text-amber-900 hover:text-amber-700">cenax09@gmail.com</a>.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                <h3 className="flex items-center gap-2 font-bold text-rose-700 mb-2">
                                    <XCircle className="w-4 h-4" /> Dilarang Ubah Kode
                                </h3>
                                <p className="text-rose-900/70 text-sm">
                                    Walaupun open source, Anda <strong>dilarang keras</strong> memodifikasi kode internal tanpa izin.
                                </p>
                            </div>
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                <h3 className="flex items-center gap-2 font-bold text-rose-700 mb-2">
                                    <XCircle className="w-4 h-4" /> Dilarang Jual Beli
                                </h3>
                                <p className="text-rose-900/70 text-sm">
                                    Aplikasi ini <strong>tidak untuk diperjualbelikan</strong>. Khusus untuk pendidikan.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Personal Use */}
        <section className="bg-indigo-50/50 p-8 rounded-2xl border border-indigo-100 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                    <UserCheck className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-indigo-900 mb-2">3. Penggunaan Pribadi</h2>
                    <p className="text-indigo-800/80 leading-relaxed">
                        Untuk penggunaan perorangan, aturan tidak terlalu ketat, selama prinsip dasar tidak memperjualbelikan dan kredit pembuat asli tetap dijaga.
                    </p>
                </div>
            </div>
        </section>

        {/* Standard Clauses */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">4. Pedoman Standar</h2>
            <div className="space-y-6">
                <div>
                    <h3 className="font-bold text-slate-800 mb-1">Penggunaan yang Diterima</h3>
                    <p className="text-slate-600 text-sm">Anda setuju menggunakan platform ini hanya untuk tujuan pendidikan yang sah. Dilarang curang atau merusak sistem.</p>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 mb-1">Integritas Akademik</h3>
                    <p className="text-slate-600 text-sm">Rushless Exam menegakkan integritas. Ketidakjujuran dapat berakibat sanksi disipliner.</p>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 mb-1">Penafian (Disclaimer)</h3>
                    <p className="text-slate-600 text-sm">Disediakan "apa adanya". Kami berusaha agar sistem selalu aktif tetapi tidak menjamin bebas error.</p>
                </div>
            </div>
        </section>
    </div>
);
