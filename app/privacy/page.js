'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Globe, ShieldCheck, Database, Lock, Server, FileText, Mail, Eye } from 'lucide-react';

export default function PrivacyPage() {
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
                        <ShieldCheck className="w-10 h-10" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
                        {lang === 'en' ? 'Privacy Policy' : 'Kebijakan Privasi'}
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        {lang === 'en'
                            ? 'Your trust is our priority. We are committed to protecting your data with transparency and strict security standards.'
                            : 'Kepercayaan Anda adalah prioritas kami. Kami berkomitmen melindungi data Anda dengan transparansi dan standar keamanan yang ketat.'}
                    </p>
                    <div className="mt-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-medium uppercase tracking-wider">
                        {lang === 'en' ? 'Last Updated: Feb 20, 2026' : 'Terakhir Diperbarui: 20 Feb 2026'}
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                    {lang === 'en' ? <EnglishContent /> : <IndonesianContent />}
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
        {/* Introduction */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <FileText className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">1. Introduction</h2>
                    <p className="text-slate-600 leading-relaxed">
                        Welcome to Rushless Exam. We respect your privacy and are committed to protecting the personal data of our students, teachers, and administrators.
                        This Privacy Policy explains how we collect, use, and safeguard your information when you use our exam platform.
                    </p>
                </div>
            </div>
        </section>

        {/* Data Storage - Highlighted */}
        <section className="bg-emerald-50/50 p-8 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-emerald-100/30 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="flex items-start gap-4 relative z-10">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                    <Server className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-emerald-900 mb-3">2. Data Storage & Sharing</h2>
                    <div className="prose prose-emerald text-emerald-800/80 leading-relaxed">
                        <p className="mb-4">
                            <strong>Host Server Storage:</strong> All data collected by this application is stored strictly on the provider's hosting server.
                        </p>
                        <div className="bg-white/60 p-4 rounded-xl border border-emerald-200/50 flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm font-medium">
                                We guarantee that <strong>no data is sent to external servers</strong> or third parties. Your data remains isolated within the environment where this application is hosted.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Security Responsibilities */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Lock className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">3. Security Responsibilities</h2>
                    <p className="text-slate-600 mb-4">While we implement standard security measures, security is a shared responsibility:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-1">Users</h3>
                            <p className="text-sm text-slate-600">Responsible for account security (e.g., strong passwords).</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-1">Administrators</h3>
                            <p className="text-sm text-slate-600">Responsible for the overall security of the hosting server.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Information Collection */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <Database className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">4. Information We Collect</h2>
                    <p className="text-slate-600 mb-4">We collect minimal information necessary for the educational purpose:</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {['Identity Data', 'Role Data', 'Exam Data', 'Usage Data'].map((item) => (
                            <li key={item} className="flex items-center gap-2 text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>

        {/* Contact */}
        <section className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-2xl shadow-lg text-white">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <Mail className="w-6 h-6 text-indigo-300" />
                </div>
                <div>
                    <h2 className="text-xl font-bold mb-1">Have Questions?</h2>
                    <p className="text-slate-300 text-sm">
                        Contact the school administration or the platform developer via the Support page for any privacy concerns.
                    </p>
                </div>
            </div>
        </section>
    </div>
);

const IndonesianContent = () => (
    <div className="space-y-6">
        {/* Introduction */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <FileText className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">1. Pendahuluan</h2>
                    <p className="text-slate-600 leading-relaxed">
                        Selamat datang di Rushless Exam. Kami menghargai privasi Anda dan berkomitmen untuk melindungi data pribadi siswa, guru, dan administrator kami.
                        Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan menjaga informasi Anda.
                    </p>
                </div>
            </div>
        </section>

        {/* Data Storage - Highlighted */}
        <section className="bg-emerald-50/50 p-8 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-emerald-100/30 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="flex items-start gap-4 relative z-10">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                    <Server className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-emerald-900 mb-3">2. Penyimpanan & Berbagi Data</h2>
                    <div className="prose prose-emerald text-emerald-800/80 leading-relaxed">
                        <p className="mb-4">
                            <strong>Penyimpanan Server Host:</strong> Semua data yang dikumpulkan oleh aplikasi ini disimpan secara ketat di server penyedia hosting.
                        </p>
                        <div className="bg-white/60 p-4 rounded-xl border border-emerald-200/50 flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm font-medium">
                                Kami menjamin bahwa <strong>tidak ada data yang dikirimkan ke server luar</strong> atau pihak ketiga sama sekali. Data Anda tetap terisolasi di dalam lingkungan tempat aplikasi ini di-host.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Security Responsibilities */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Lock className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">3. Tanggung Jawab Keamanan</h2>
                    <p className="text-slate-600 mb-4">Meskipun aplikasi ini menggunakan standar keamanan yang baik, keamanan adalah tanggung jawab bersama:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-1">Pengguna</h3>
                            <p className="text-sm text-slate-600">Bertanggung jawab atas keamanan akun (misalnya, password kuat).</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-1">Administrator</h3>
                            <p className="text-sm text-slate-600">Bertanggung jawab penuh atas keamanan server hosting.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Information Collection */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <Database className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">4. Informasi yang Kami Kumpulkan</h2>
                    <p className="text-slate-600 mb-4">Kami hanya mengumpulkan informasi minimal untuk kepentingan ujian:</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {['Data Identitas', 'Data Peran', 'Data Ujian', 'Data Penggunaan'].map((item) => (
                            <li key={item} className="flex items-center gap-2 text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>

        {/* Contact */}
        <section className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-2xl shadow-lg text-white">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <Mail className="w-6 h-6 text-indigo-300" />
                </div>
                <div>
                    <h2 className="text-xl font-bold mb-1">Punya Pertanyaan?</h2>
                    <p className="text-slate-300 text-sm">
                        Hubungi administrasi sekolah atau via halaman Dukungan jika memiliki pertanyaan privasi.
                    </p>
                </div>
            </div>
        </section>
    </div>
);
