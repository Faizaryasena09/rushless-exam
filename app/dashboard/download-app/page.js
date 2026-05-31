'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DownloadAppPage() {
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeInUp {
                  from {
                    opacity: 0;
                    transform: translateY(15px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                @keyframes fadeInDown {
                  from {
                    opacity: 0;
                    transform: translateY(-15px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                .animate-fade-in-down {
                  animation: fadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .animate-fade-in-up {
                  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                  opacity: 0;
                }
            ` }} />

            {/* Header */}
            <div className="animate-fade-in-down flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Download Aplikasi</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Dapatkan aplikasi klien resmi untuk Android</p>
                    </div>
                </div>
                <Link href="/dashboard" className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                    Kembali
                </Link>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Mockup & Download Link */}
                <div className="animate-fade-in-up lg:col-span-7 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-6 sm:p-8 flex flex-col justify-between overflow-hidden shadow-sm" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
                    <div className="space-y-6">
                        <div>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 mb-3">
                                Android Client App
                            </span>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                                Ujian Lebih Aman dengan Rushless Safer
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm sm:text-base leading-relaxed">
                                Rushless Safer adalah aplikasi khusus ujian terintegrasi yang dirancang untuk menjaga integritas dan ketenangan pelaksanaan ujian online Anda dari kecurangan.
                            </p>
                        </div>

                        {/* Feature Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-100 dark:border-slate-700/30">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Kunci Layar (Kiosk)</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Mencegah keluar dari aplikasi saat ujian.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-100 dark:border-slate-700/30">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Deteksi Sistem</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Blokir screenshot, split screen, dan dual app.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Download Button Section */}
                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                        <a
                            href="/Rushless Safer.apk"
                            download="Rushless Safer.apk"
                            className="w-full py-4 px-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-black text-center rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-[1.01] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 group"
                        >
                            <svg className="w-5 h-5 animate-bounce group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Download APK (Rushless Safer v1.0)</span>
                        </a>
                        <p className="text-[10px] text-center text-slate-400 mt-3 uppercase tracking-wider font-bold">
                            Ukuran File: ~9.5 MB • Android 8.0 (Oreo) ke atas
                        </p>
                    </div>
                </div>

                {/* Right Side: Mockup Preview image */}
                <div className="animate-fade-in-up lg:col-span-5 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex items-center justify-center min-h-[400px] relative group" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 z-10"></div>
                    <img 
                        src="/rushless_app_mockup.png" 
                        alt="Rushless Safer Mockup" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                </div>
            </div>

            {/* Installation Instructions */}
            <div className="animate-fade-in-up bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-6 sm:p-8 shadow-sm" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 01-2 2h0a2 2 0 01-2-2v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Cara Install Aplikasi
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                    <div className="space-y-2 relative">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black text-sm">1</span>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Unduh Aplikasi</h4>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pl-11">
                            Klik tombol download di atas untuk mengunduh berkas installer APK langsung ke perangkat smartphone Anda.
                        </p>
                    </div>

                    <div className="space-y-2 relative">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black text-sm">2</span>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Izinkan Sumber Tidak Dikenal</h4>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pl-11">
                            Jika muncul peringatan keamanan, buka Pengaturan &gt; Keamanan &gt; Izinkan Instalasi dari Sumber Tidak Dikenal pada browser atau file manager Anda.
                        </p>
                    </div>

                    <div className="space-y-2 relative">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black text-sm">3</span>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Buka &amp; Mulai Ujian</h4>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pl-11">
                            Setelah instalasi selesai, buka aplikasi Rushless Safer, berikan izin layar sematan (kiosk mode), login, dan masuki halaman pengerjaan ujian.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
