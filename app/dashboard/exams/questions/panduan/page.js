'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/app/context/LanguageContext';

const Icons = {
    BookOpen: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    CheckCircle: () => <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Info: () => <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Download: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    ArrowLeft: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    Sparkles: () => <svg className="w-5 h-5 text-amber-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
};

export default function GuidePage() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('mc');

    const tabs = [
        { id: 'mc', label: 'Pilihan Ganda' },
        { id: 'pgk', label: 'PGK (Pilihan Ganda Kompleks)' },
        { id: 'tf', label: 'Benar / Salah' },
        { id: 'matching', label: 'Menjodohkan' },
        { id: 'essay', label: 'Uraian / Esai' }
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 animate-fade-in">
            {/* Header Hero */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-[2.5rem] p-8 md:p-12 mb-8 relative overflow-hidden shadow-xl border border-indigo-950">
                <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-12 translate-x-12"></div>
                <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl translate-y-24"></div>
                
                <div className="relative z-10 max-w-3xl">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 text-indigo-300 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                            <Icons.BookOpen />
                            Dokumentasi Resmi
                        </span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-4">
                        Panduan Penulisan & Penyekoran Soal
                    </h1>
                    <p className="text-slate-300 text-sm md:text-base leading-relaxed font-medium mb-6">
                        Pelajari cara memformat dokumen Word (.docx) agar ter-import secara sempurna, serta pahami berbagai metode penyekoran otomatis yang tersedia untuk tiap tipe soal.
                    </p>
                    
                    <div className="flex flex-wrap gap-3">
                        <a 
                            href="/Template Soal Rushless.docx" 
                            download 
                            className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 border border-indigo-500"
                        >
                            <Icons.Download />
                            Unduh Template DOCX
                        </a>
                        <Link 
                            href=".." 
                            className="inline-flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 border border-white/10"
                        >
                            <Icons.ArrowLeft />
                            Kembali ke Kelola Ujian
                        </Link>
                    </div>
                </div>
            </div>

            {/* Quick Stats Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Icons.Sparkles />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-xs">Parsing Cerdas</h4>
                        <p className="text-xs text-slate-400 font-bold mt-1">Parser mendeteksi tipe soal secara otomatis berdasarkan format pilihan dan kunci jawaban yang di-upload.</p>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Icons.CheckCircle />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-xs">Penyekoran Beragam</h4>
                        <p className="text-xs text-slate-400 font-bold mt-1">Dukung strategi penyekoran bertahap, proporsional, penalti, hingga pencocokan kata kunci esai secara instan.</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                        <Icons.Info />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-xs">Fleksibilitas Media</h4>
                        <p className="text-xs text-slate-400 font-bold mt-1">Mendukung penyisipan gambar, tabel kompleks, formula matematika (LaTeX), hingga cetak tebal/miring.</p>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-8 flex flex-wrap gap-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 min-w-[150px] py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-white'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Details */}
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm p-6 md:p-8">
                {/* 1. Multiple Choice */}
                {activeTab === 'mc' && (
                    <div className="space-y-8 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Pilihan Ganda Tunggal (Multiple Choice)</h2>
                            <p className="text-sm text-slate-400 font-bold">Tipe soal standar dengan satu pilihan jawaban benar.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Contoh Format Penulisan (DOCX)</h3>
                                <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                                    <p className="text-slate-500 mb-2"># Menandai dimulainya soal Pilihan Ganda</p>
                                    <p className="text-yellow-400">[Multiple Choice]</p>
                                    <p className="text-white mt-2">1. Siapakah presiden pertama Republik Indonesia?</p>
                                    <p className="text-slate-400 font-bold">[OPT]</p>
                                    <p className="text-slate-300">A. Soeharto</p>
                                    <p className="text-slate-300">B. Ir. Soekarno</p>
                                    <p className="text-slate-300">C. B.J. Habibie</p>
                                    <p className="text-slate-300">D. Abdurrahman Wahid</p>
                                    <p className="text-emerald-400 mt-2">Kunci: B</p>
                                    <p className="text-blue-400">Poin: 10</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Visualisasi Hasil di Aplikasi</h3>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-slate-50 dark:bg-slate-900/30">
                                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded text-[9px] font-black uppercase tracking-widest">Pilihan Ganda</span>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-3 text-sm">Siapakah presiden pertama Republik Indonesia?</p>
                                    
                                    <div className="mt-4 space-y-2 text-xs font-bold">
                                        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300">
                                            <span className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">A</span>
                                            <span>Soeharto</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-emerald-50/50 dark:bg-emerald-900/10 border-2 border-emerald-500 rounded-xl text-emerald-700 dark:text-emerald-400">
                                            <div className="flex items-center gap-3">
                                                <span className="w-6 h-6 rounded bg-emerald-600 text-white flex items-center justify-center">B</span>
                                                <span>Ir. Soekarno</span>
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full">Kunci</span>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300">
                                            <span className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">C</span>
                                            <span>B.J. Habibie</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                            <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">Aturan Penyekoran</h3>
                            <div className="bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider rounded">Strategi: Standard</span>
                                </div>
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                                    Penilaian tipe ini menggunakan logika biner sederhana:
                                </p>
                                <ul className="list-disc list-inside text-xs font-bold text-slate-500 dark:text-slate-400 space-y-1">
                                    <li>Jika jawaban siswa sama persis dengan kunci jawaban (misalnya <code className="text-indigo-600">B</code>), maka akan mendapatkan nilai penuh sejumlah <code className="text-indigo-600">Poin</code> (misal: 10 poin).</li>
                                    <li>Jika salah atau kosong, siswa mendapatkan <code className="text-red-500">0</code> poin.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Complex Multiple Choice (PGK) */}
                {activeTab === 'pgk' && (
                    <div className="space-y-8 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Pilihan Ganda Kompleks (PGK)</h2>
                            <p className="text-sm text-slate-400 font-bold">Siswa diperbolehkan memilih lebih dari satu opsi jawaban menggunakan tombol centang (checkbox).</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Contoh Format Penulisan (DOCX)</h3>
                                <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                                    <p className="text-slate-500 mb-2"># Sistem otomatis mendeteksi PGK jika kunci berupa deret dipisah koma</p>
                                    <p className="text-yellow-400">[Multiple Choice]</p>
                                    <p className="text-white mt-2">2. Di antara organel sel berikut, manakah yang hanya ditemukan pada sel tumbuhan? [PGK_PARTIAL]</p>
                                    <p className="text-slate-400 font-bold">[OPT]</p>
                                    <p className="text-slate-300">A. Dinding Sel</p>
                                    <p className="text-slate-300">B. Kloroplas</p>
                                    <p className="text-slate-300">C. Lisosom</p>
                                    <p className="text-slate-300">D. Sentriol</p>
                                    <p className="text-emerald-400 mt-2">Kunci: A, B</p>
                                    <p className="text-blue-400">Poin: 15</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Visualisasi Hasil di Aplikasi</h3>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-slate-50 dark:bg-slate-900/30">
                                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded text-[9px] font-black uppercase tracking-widest">Pilihan Ganda Kompleks</span>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-3 text-sm">Di antara organel sel berikut, manakah yang hanya ditemukan pada sel tumbuhan?</p>
                                    
                                    <div className="mt-4 space-y-2 text-xs font-bold">
                                        <div className="flex items-center justify-between p-3 bg-emerald-50/55 dark:bg-emerald-950/10 border-2 border-emerald-500 rounded-xl text-emerald-700 dark:text-emerald-400">
                                            <div className="flex items-center gap-3">
                                                <span className="w-6 h-6 rounded bg-emerald-600 text-white flex items-center justify-center">A</span>
                                                <span>Dinding Sel</span>
                                            </div>
                                            <div className="w-4 h-4 rounded border-2 border-emerald-600 flex items-center justify-center bg-emerald-600 text-white">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-emerald-50/55 dark:bg-emerald-950/10 border-2 border-emerald-500 rounded-xl text-emerald-700 dark:text-emerald-400">
                                            <div className="flex items-center gap-3">
                                                <span className="w-6 h-6 rounded bg-emerald-600 text-white flex items-center justify-center">B</span>
                                                <span>Kloroplas</span>
                                            </div>
                                            <div className="w-4 h-4 rounded border-2 border-emerald-600 flex items-center justify-center bg-emerald-600 text-white">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300">
                                            <div className="flex items-center gap-3">
                                                <span className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">C</span>
                                                <span>Lisosom</span>
                                            </div>
                                            <div className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                            <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">4 Pilihan Strategi Penyekoran (Tambahkan Tag di Soal)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-slate-100 dark:border-slate-700 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[9px] font-black uppercase rounded">STRICT [PGK_STRICT]</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        Siswa harus mencentang **semua kunci jawaban** dengan benar tanpa ada pilihan salah yang tercentang.
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-2 italic">Contoh: Kunci A, B. Siswa jawab A, B mendapat 100% poin. Jawab A saja mendapat 0%.</p>
                                </div>

                                <div className="border border-slate-100 dark:border-slate-700 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-950 text-yellow-750 dark:text-yellow-350 text-[9px] font-black uppercase rounded">ANY MATCH [PGK_ANY]</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        Siswa mendapatkan **poin penuh** jika memilih minimal 1 jawaban benar dan tidak ada pilihan salah yang tercentang.
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-2 italic">Contoh: Kunci A, B. Siswa jawab A mendapat 100%. Siswa jawab A, C mendapat 0% (karena C salah).</p>
                                </div>

                                <div className="border border-slate-100 dark:border-slate-700 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[9px] font-black uppercase rounded">ADDITIVE [PGK_ADDITIVE]</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        Penilaian bersifat proporsional murni. Nilai diberikan berdasarkan persentase jawaban benar yang berhasil dicentang, tanpa penalti jika memilih opsi yang salah.
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-2 italic">Formula: (Benar Terpilih / Total Kunci Benar) * Poin</p>
                                </div>

                                <div className="border border-slate-100 dark:border-slate-700 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] font-black uppercase rounded">PARTIAL PENALTY (Default)</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        Penilaian proporsional dengan **penalti pengurangan**. Opsi salah yang dicentang akan mengurangi poin dari jawaban benar yang berhasil dicentang.
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-2 italic">Formula: [Max(0, Benar Terpilih - Salah Terpilih) / Total Kunci Benar] * Poin</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. True or False */}
                {activeTab === 'tf' && (
                    <div className="space-y-8 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Benar / Salah (True or False)</h2>
                            <p className="text-sm text-slate-400 font-bold">Sistem akan mengenali tipe soal ini secara otomatis bila hanya terdapat tepat dua opsi bertuliskan "Benar" dan "Salah".</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Contoh Format Penulisan (DOCX)</h3>
                                <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                                    <p className="text-slate-500 mb-2"># Pastikan penulisan opsi persis "Benar" dan "Salah"</p>
                                    <p className="text-yellow-400">[Multiple Choice]</p>
                                    <p className="text-white mt-2">3. Ibu kota dari negara Prancis adalah kota Paris.</p>
                                    <p className="text-slate-400 font-bold">[OPT]</p>
                                    <p className="text-slate-300">A. Benar</p>
                                    <p className="text-slate-300">B. Salah</p>
                                    <p className="text-emerald-400 mt-2">Kunci: A</p>
                                    <p className="text-blue-400">Poin: 10</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Visualisasi Hasil di Aplikasi</h3>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-slate-50 dark:bg-slate-900/30">
                                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded text-[9px] font-black uppercase tracking-widest">Benar / Salah</span>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-3 text-sm">Ibu kota dari negara Prancis adalah kota Paris.</p>
                                    
                                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold">
                                        <div className="flex flex-col items-center justify-center p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border-2 border-emerald-500 rounded-2xl text-emerald-700 dark:text-emerald-400">
                                            <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-1 text-sm">B</span>
                                            <span>Benar</span>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400">
                                            <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-1 text-sm text-slate-400">S</span>
                                            <span>Salah</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                            <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">Aturan Penyekoran</h3>
                            <div className="bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider rounded">Strategi: Standard</span>
                                </div>
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                                    Sistem penilaian sama seperti Pilihan Ganda Tunggal:
                                </p>
                                <ul className="list-disc list-inside text-xs font-bold text-slate-500 dark:text-slate-400 space-y-1">
                                    <li>Jika jawaban siswa cocok dengan kunci jawaban (misalnya memilih Benar), maka akan memperoleh nilai penuh.</li>
                                    <li>Jika jawaban tidak cocok atau tidak dijawab, mendapatkan 0 poin.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. Matching */}
                {activeTab === 'matching' && (
                    <div className="space-y-8 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Menjodohkan (Matching)</h2>
                            <p className="text-sm text-slate-400 font-bold">Menghubungkan baris premis (angka) dengan baris respons (huruf) secara tepat.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Contoh Format Penulisan (DOCX)</h3>
                                <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                                    <p className="text-yellow-400">[Matching]</p>
                                    <p className="text-white mt-2">4. Pasangkanlah negara berikut dengan ibu kotanya masing-masing!</p>
                                    <p className="text-slate-400 font-bold mt-2"># Daftar Premis (harus diawali Angka)</p>
                                    <p className="text-slate-300">1) Indonesia</p>
                                    <p className="text-slate-300">2) Jepang</p>
                                    <p className="text-slate-300">3) Inggris</p>
                                    <p className="text-slate-400 font-bold mt-2"># Daftar Respons (harus diawali Huruf)</p>
                                    <p className="text-slate-300">A) London</p>
                                    <p className="text-slate-300">B) Tokyo</p>
                                    <p className="text-slate-300">C) Jakarta</p>
                                    <p className="text-emerald-400 mt-2">Kunci: 1-C, 2-B, 3-A</p>
                                    <p className="text-blue-400">Poin: 15</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Visualisasi Hasil di Aplikasi</h3>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-slate-50 dark:bg-slate-900/30">
                                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded text-[9px] font-black uppercase tracking-widest">Menjodohkan</span>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-3 text-sm">Pasangkanlah negara berikut dengan ibu kotanya masing-masing!</p>
                                    
                                    <div className="mt-4 space-y-3 text-xs font-bold">
                                        <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                            <span>1. Indonesia</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400">Terpasang ke:</span>
                                                <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 rounded-md">Jakarta</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                            <span>2. Jepang</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400">Terpasang ke:</span>
                                                <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 rounded-md">Tokyo</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                            <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">Aturan Penyekoran</h3>
                            <div className="bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider rounded">Strategi: Proporsional Parsial</span>
                                </div>
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                                    Nilai untuk soal menjodohkan dihitung berdasarkan jumlah pasangan premis-respons yang berhasil dicocokkan siswa secara proporsional.
                                </p>
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                    <span className="text-indigo-600 font-extrabold">Formula:</span> <code className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">(Pasangan Benar / Total Pasangan Kunci) * Poin Soal</code>
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold italic">
                                    Contoh: Total poin = 15 dengan 3 pasangan. Jika siswa memasangkan 2 premis dengan benar, siswa mendapatkan: (2 / 3) * 15 = 10 poin.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. Essay / Uraian */}
                {activeTab === 'essay' && (
                    <div className="space-y-8 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Uraian / Esai (Essay)</h2>
                            <p className="text-sm text-slate-400 font-bold">Pertanyaan terbuka yang mengharuskan siswa mengetik jawaban secara bebas.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Contoh Format Penulisan (DOCX)</h3>
                                <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                                    <p className="text-yellow-400">[Essay]</p>
                                    <p className="text-white mt-2">5. Jelaskan proses terjadinya fotosintesis pada tumbuhan hijau! [ESSAY_ANY]</p>
                                    <p className="text-slate-500 mt-2"># Tulis kata kunci kelulusan jawaban dipisah dengan koma</p>
                                    <p className="text-emerald-400">Kunci: klorofil, matahari, karbon dioksida, oksigen</p>
                                    <p className="text-blue-400">Poin: 20</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Visualisasi Hasil di Aplikasi</h3>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-slate-50 dark:bg-slate-900/30">
                                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded text-[9px] font-black uppercase tracking-widest">Uraian / Esai</span>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-3 text-sm">Jelaskan proses terjadinya fotosintesis pada tumbuhan hijau!</p>
                                    
                                    <div className="mt-4 space-y-2 text-xs font-bold">
                                        <label className="text-slate-400 block mb-1">Jawaban Siswa:</label>
                                        <div className="w-full h-24 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-350 italic">
                                            "Proses fotosintesis memerlukan cahaya matahari dan klorofil di daun..."
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                            <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">4 Pilihan Strategi Penyekoran (Tambahkan Tag di Soal)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-slate-100 dark:border-slate-700 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[9px] font-black uppercase rounded">STRICT [ESSAY_STRICT]</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        Siswa mendapatkan **poin penuh** jika dan hanya jika **seluruh kata kunci** yang Anda tulis di kunci jawaban terdeteksi di dalam lembar esai siswa.
                                    </p>
                                </div>

                                <div className="border border-slate-100 dark:border-slate-700 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-950 text-yellow-750 dark:text-yellow-350 text-[9px] font-black uppercase rounded">ANY KEYWORD [ESSAY_ANY]</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        Siswa mendapatkan **poin penuh** jika terdapat **minimal satu kata kunci saja** yang terdeteksi di lembar jawaban siswa.
                                    </p>
                                </div>

                                <div className="border border-slate-100 dark:border-slate-700 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[9px] font-black uppercase rounded">RATIO (Default)</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        Nilai proporsional berdasarkan rasio kata kunci yang cocok dengan jawaban siswa.
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-2 italic">Formula: (Jumlah Kata Kunci Cocok / Total Kata Kunci Kunci) * Poin</p>
                                </div>

                                <div className="border border-slate-100 dark:border-slate-700 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[9px] font-black uppercase rounded">MANUAL [ESSAY_MANUAL]</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        Penilaian otomatis dinonaktifkan. Nilai awal diatur ke <code className="text-rose-500">0</code> dan harus dievaluasi secara manual oleh guru melalui menu periksa jawaban.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* General Tips & Rules */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm p-8 mt-8">
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                    <Icons.Info />
                    Tips & Aturan Penting Upload DOCX
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                    <ul className="list-disc list-inside space-y-3">
                        <li>
                            <span className="text-indigo-600 dark:text-indigo-400">Pemisah Soal:</span> Gunakan tag tipe soal seperti <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">[Multiple Choice]</code>, <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">[Matching]</code>, atau <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">[Essay]</code> di baris tersendiri sebelum butir soal ditulis.
                        </li>
                        <li>
                            <span className="text-indigo-600 dark:text-indigo-400">Penyisipan Gambar:</span> Gambar dapat diletakkan langsung di dalam dokumen Word. Parser akan otomatis menyimpannya ke server.
                        </li>
                        <li>
                            <span className="text-indigo-600 dark:text-indigo-400">Format Bobot Nilai:</span> Gunakan tag <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">[POINT: 10]</code> atau <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">[BOBOT: 10]</code> di akhir teks pertanyaan untuk mengatur nilai per butir soal.
                        </li>
                    </ul>

                    <ul className="list-disc list-inside space-y-3">
                        <li>
                            <span className="text-indigo-600 dark:text-indigo-400">Tabel & Equation:</span> Tabel di Word akan diubah menjadi tabel HTML murni. Anda juga dapat menggunakan equation editor Word, yang akan diekspor menjadi gambar/formula terformat rapi.
                        </li>
                        <li>
                            <span className="text-indigo-600 dark:text-indigo-400">Satu Dokumen:</span> Dokumen tunggal docx dapat menampung campuran dari semua tipe soal di atas sekaligus secara bergantian.
                        </li>
                        <li>
                            <span className="text-indigo-600 dark:text-indigo-400">Penataan Baris Pilihan:</span> Opsi pilihan ganda harus diawali dengan karakter huruf abjad diikuti oleh pemisah titik atau tanda kurung tutup (contoh: <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded">A.</code> atau <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded">A)</code>).
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
