'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    ChevronUp, ChevronDown, ArrowUpDown, RefreshCcw, Users, Clock,
    FileSpreadsheet, PlusCircle, BellRing, CheckCircle2, HelpCircle, X
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/app/context/LanguageContext';

// Format seconds to HH:MM:SS
function formatTime(seconds) {
    if (seconds === null || seconds < 0) return '--:--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

const Icons = {
    Lock: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    Unlock: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>,
    Logout: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    Refresh: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Stop: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>,
    Log: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    X: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
};

const ACTION_COLORS = {
    START:    'bg-emerald-100 text-emerald-700',
    SUBMIT:   'bg-indigo-100 text-indigo-700',
    ANSWER:   'bg-sky-100 text-sky-700',
    NAVIGATE: 'bg-slate-100 text-slate-600',
    FLAG:     'bg-amber-100 text-amber-700',
    SECURITY: 'bg-red-100 text-red-700',
};

/* ------------------------------------------------------------------
 * Metadata aksi: dipakai untuk tooltip, label tombol, dan panduan
 * ------------------------------------------------------------------ */
const ACTION_META = {
    toggle_login_lock: {
        label: 'Kunci Login',
        hint: 'Memblokir atau membuka ability akun siswa untuk login kembali. Akun yang dikunci otomatis dikeluarkan dari sesinya.'
    },
    force_logout: {
        label: 'Logout Paksa',
        hint: 'Meng-terminate sesi siswa di perangkatnya dan mengarahkan mereka ke halaman login. Progres jawaban tetap tersimpan.'
    },
    view_logs: {
        label: 'Log Realtime',
        hint: 'Membuka panel log aktivitas siswa secara real-time: navigasi soal, jawaban, dan kejadian keamanan.'
    },
    unlock_violation: {
        label: 'Buka Kunci Pelanggaran',
        hint: 'Membuka kunci overclock/pelanggaran sehingga siswa bisa melanjutkan ujian dari soal yang terkunci.'
    },
    add_time: {
        label: 'Tambah Waktu',
        hint: 'Menambahkan waktu (menit) ke sisa waktu siswa yang sedang mengerjakan ujian.'
    },
    force_submit: {
        label: 'Paksa Kumpul',
        hint: 'Mengakhiri sesi ujian siswa seketika dan menarik semua jawaban yang tersimpan ke server. Tidak dapat dibatalkan.'
    },
    reset_exam: {
        label: 'Reset Ujian',
        hint: 'Menghapus seluruh progres pengerjaan siswa yang sedang berjalan dan mengeluarkan mereka dari ujian.'
    }
};

const BUTTON_TONES = {
    slate: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40',
    red: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/60',
};

/* Tombol aksi baris: icon + label selalu terlihat (tanpa tooltip hover) */
function ActionButton({ metaKey, icon: Icon, onClick, tone = 'slate', pulse = false }) {
    const meta = ACTION_META[metaKey];
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${BUTTON_TONES[tone]} ${pulse ? 'animate-pulse ring-2 ring-amber-400/60' : ''}`}
        >
            <Icon size={14} className="shrink-0" />
            <span className="whitespace-nowrap">{meta.label}</span>
        </button>
    );
}

/* --- Student Timer --- */
function StudentTimer({ secondsLeft }) {
    // Sisa waktu ditampilkan dari deadline absolut, bukan dengan mengurangi 1
    // detik tiap tick. Rantai setTimeout sebelumnya bisa melenceng jauh dari
    // timer siswa karena tiap tick menambah penundaan.
    const [display, setDisplay] = useState(secondsLeft);

    // Sisa waktu dihitung dari deadline absolut, bukan dikurangi 1 detik tiap
    // tick: rantai setTimeout lama bisa melenceng jauh dari timer siswa karena
    // tiap tick menambah penundaan sendiri.
    //
    // Nilai dari server dijadikan titik acuan di dalam effect, lalu display
    // di-refresh dari sana. Tidak ada setState langsung di body effect supaya
    // tidak memicu render bertingkat.
    useEffect(() => {
        if (secondsLeft === null || secondsLeft === undefined) return;
        const deadline = Date.now() + secondsLeft * 1000;
        const id = setInterval(() => {
            setDisplay(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
        }, 250);
        return () => clearInterval(id);
    }, [secondsLeft]);

    const isCritical = display !== null && display <= 300;
    const isExpired = display === 0;

    if (secondsLeft === null || secondsLeft === undefined || display === null || display === undefined) {
        return <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-400">—</span>;
    }

    return (
        <span className={`inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2 py-1 rounded-lg ${
            isExpired  ? 'bg-slate-100 text-slate-400' :
            isCritical ? 'bg-red-100 text-red-600 animate-pulse' :
                         'bg-emerald-50 text-emerald-700'
        }`}>
            <Icons.Clock />
            {isExpired ? 'Habis' : formatTime(display)}
        </span>
    );
}

/* --- Log Panel --- */
function LogPanel({ student, onClose, sseLog }) {
    const { timezone: appTimezone } = useLanguage();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const bottomRef = useRef(null);
    const knownIdsRef = useRef(new Set());

    useEffect(() => {
        if (sseLog && sseLog.attemptId == student.attempt_id) {
            if (!knownIdsRef.current.has(sseLog.id)) {
                knownIdsRef.current.add(sseLog.id);
                setLogs(prev => [...prev, {
                    id: sseLog.id,
                    attempt_id: sseLog.attemptId,
                    action_type: sseLog.actionType,
                    description: sseLog.description,
                    created_at: sseLog.timestamp
                }]);
            }
        }
    }, [sseLog, student.attempt_id]);

    const fetchLogs = useCallback(async () => {
        if (!student?.attempt_id) return;
        try {
            const res = await fetch(`/api/exams/logs?attempt_id=${student.attempt_id}`);
            if (!res.ok) return;
            const data = await res.json();
            const newLogs = (data.logs || []).filter(l => !knownIdsRef.current.has(l.id));
            if (newLogs.length > 0) {
                newLogs.forEach(l => knownIdsRef.current.add(l.id));
                setLogs(prev => [...prev, ...newLogs]);
            }
        } catch (e) {
            console.error('Log fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, [student?.attempt_id]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const formatLogTime = (ts, timeZone) => new Date(ts).toLocaleTimeString('id-ID', { timeZone: timeZone || undefined, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
                <div aria-hidden className="h-1 w-full shrink-0 bg-gradient-to-r from-indigo-500 to-violet-500" />
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 flex-shrink-0">
                    <div className="min-w-0">
                        <h2 className="font-bold text-slate-800 dark:text-white text-sm">Log Realtime</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {student.name || student.username} — <span className="font-bold text-indigo-600 dark:text-indigo-300">{student.current_exam}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </span>
                            Live
                        </span>
                        <button onClick={onClose} aria-label="Tutup" className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"><Icons.X /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
                    {loading && logs.length === 0 && <div className="text-center text-slate-400 py-10">Memuat log...</div>}
                    {!loading && logs.length === 0 && <div className="text-center text-slate-400 py-10">Belum ada log untuk sesi ini.</div>}
                    {logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-2">
                            <span className="text-slate-400 whitespace-nowrap flex-shrink-0 pt-0.5">{formatLogTime(log.created_at, appTimezone)}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap flex-shrink-0 ${ACTION_COLORS[log.action_type] || 'bg-slate-100 text-slate-600'}`}>
                                {log.action_type}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300 break-words leading-relaxed">{log.description}</span>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 flex-shrink-0">
                    <p className="text-xs text-slate-400 text-center">{logs.length} entri log • Real-time (SSE)</p>
                </div>
            </div>
        </div>
    );
}

/* --- Panduan Aksi --- */
function GuideModal({ isOpen, onClose }) {
    if (!isOpen) return null;
    const groups = [
        {
            title: 'Aksi Per Siswa',
            color: 'text-indigo-600 dark:text-indigo-400',
            items: ['toggle_login_lock', 'force_logout', 'view_logs', 'unlock_violation']
        },
        {
            title: 'Aksi Ujian',
            color: 'text-emerald-600 dark:text-emerald-400',
            items: ['add_time', 'force_submit', 'reset_exam']
        }
    ];

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70 overflow-hidden animate-in zoom-in-95 duration-200">
                <div aria-hidden className="h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            <HelpCircle size={20} />
                        </span>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                Panduan Tombol Aksi
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Arahkan kursor ke tombol mana pun untuk melihat keterangan singkat.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Tutup" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                        <Icons.X />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {groups.map(group => (
                        <div key={group.title}>
                            <h4 className={`text-xs font-black uppercase tracking-wider mb-3 ${group.color}`}>{group.title}</h4>
                            <ul className="space-y-2">
                                {group.items.map(key => (
                                    <li key={key} className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                                        <span className="text-[11px] font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 whitespace-nowrap">
                                            {ACTION_META[key].label}
                                        </span>
                                        <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ACTION_META[key].hint}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider mb-3 text-amber-600 dark:text-amber-400">Aksi Massal</h4>
                        <ul className="space-y-2">
                            <li className="flex gap-3 items-start p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50">
                                <span className="text-[11px] font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 whitespace-nowrap">Tambah Waktu</span>
                                <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Menambah menit ke seluruh siswa yang sedang ujian pada filter aktif (tidak memengaruhi yang offline).</span>
                            </li>
                            <li className="flex gap-3 items-start p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50">
                                <span className="text-[11px] font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 whitespace-nowrap">Refresh Alert</span>
                                <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Mengirim sinyal refresh ke semua siswa aktif agar layar/alerts mereka diperbarui tanpa reload manual.</span>
                            </li>
                            <li className="flex gap-3 items-start p-3 rounded-xl bg-rose-50/60 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/50">
                                <span className="text-[11px] font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 whitespace-nowrap">Paksa Kumpul</span>
                                <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Mengakhiri sesi ujian semua siswa aktif sekaligus. Tindakan destruktif dan tidak dapat dibatalkan.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-700">
                    <button onClick={onClose} className="w-full px-4 py-3 rounded-2xl bg-slate-900 dark:bg-slate-700 text-white text-sm font-black hover:bg-slate-800 transition-colors">
                        Mengerti
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ControlPanel() {
    const { timezone: appTimezone } = useLanguage();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [sseStatus, setSseStatus] = useState('connecting');
    const [redisActive, setRedisActive] = useState(true);
    const [logStudent, setLogStudent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('All');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [onlineFirst, setOnlineFirst] = useState(false);
    const [sseLog, setSseLog] = useState(null);
    const [showGuide, setShowGuide] = useState(false);
    const [modalConfig, setModalConfig] = useState({ 
        isOpen: false, 
        type: 'confirm', 
        title: '', 
        message: '', 
        onConfirm: null, 
        inputValue: '', 
        isDestructive: false,
        targetName: ''
    });

    useEffect(() => {
        let eventSource;
        let retryTimeout;

        const connect = () => {
            if (eventSource) eventSource.close();
            setSseStatus('connecting');

            eventSource = new EventSource('/api/control/stream');

            eventSource.onopen = () => {
                setSseStatus('connected');
                setLoading(false);
            };

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.students) {
                        setStudents(data.students);
                        setRedisActive(data.redisActive ?? true);
                        setLastUpdated(new Date());
                    }
                    if (data.log_update) {
                        setSseLog(data.log_update);
                    }
                } catch (err) {
                    console.error('Error parsing SSE data:', err);
                }
            };

            eventSource.onerror = (err) => {
                console.error('SSE Error:', err);
                setSseStatus('error');
                eventSource.close();
                retryTimeout = setTimeout(connect, 5000);
            };
        };

        connect();

        return () => {
            if (eventSource) eventSource.close();
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/control/users');
            if (res.ok) {
                const data = await res.json();
                setStudents(data.students || []);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error("Manual refresh error", error);
        }
    };

    const classes = ['All', ...new Set(students.map(s => s.class_name).filter(Boolean))];

    // Pengaman tampilan: pastikan satu baris per siswa.
    // Query server sudah mengambil 1 attempt per siswa, tapi kalau suatu saat
    // data mengembalikan baris ganda, students yang muncul tetap tidak akan
    // terduplikasi di layar.
    const uniqueStudents = useMemo(() => {
      const map = new Map();
      for (const s of students) {
        const existing = map.get(s.id);
        if (!existing) {
          map.set(s.id, s);
          continue;
        }
        // Kalau ternyata dobel, pilih yang paling butuh perhatian:
        // 1) yang sedang ada attempt-nya, 2) sisa waktu paling sedikit.
        const curTime = s.attempt_id ? s.seconds_left : Number.MAX_SAFE_INTEGER;
        const oldTime = existing.attempt_id ? existing.seconds_left : Number.MAX_SAFE_INTEGER;
        if (curTime < oldTime) map.set(s.id, s);
        else if (existing.in_progress_count !== s.in_progress_count) {
          map.set(s.id, { ...existing, in_progress_count: Math.max(existing.in_progress_count || 0, s.in_progress_count || 0) });
        }
      }
      return Array.from(map.values());
    }, [students]);

    const filteredStudents = uniqueStudents.filter(student => {
        const matchesClass = selectedClass === 'All' || student.class_name === selectedClass;
        const matchesSearch = student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              student.username?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesClass && matchesSearch;
    });

    const activeStudents = useMemo(
        () => filteredStudents.filter(s => s.attempt_id),
        [filteredStudents]
    );

    const toggleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="opacity-30 group-hover:opacity-100 transition-opacity" />;
        
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 animate-in zoom-in-95 duration-200">
                {sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span className="text-[10px] font-black tracking-tighter uppercase whitespace-nowrap">
                    {columnKey === 'is_online' 
                        ? (sortConfig.direction === 'asc' ? 'ON' : 'OFF')
                        : (sortConfig.direction === 'asc' ? 'A-Z' : 'Z-A')}
                </span>
            </div>
        );
    };

    const sortedStudents = useMemo(() => {
        const data = [...filteredStudents];

        // Mode "Online First": satu klik -> online di paling atas, klik lagi -> normal
        if (onlineFirst) {
            return data.sort((a, b) => {
                if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
                const valA = (a.name || a.username).toLowerCase();
                const valB = (b.name || b.username).toLowerCase();
                return valA < valB ? -1 : valA > valB ? 1 : 0;
            });
        }

        const { key, direction } = sortConfig;
        
        data.sort((a, b) => {
            if (key === 'is_online') {
                if (a.is_online !== b.is_online) {
                    return direction === 'asc' ? (b.is_online ? -1 : 1) : (a.is_online ? -1 : 1);
                }
            }

            const valA = (a.name || a.username).toLowerCase();
            const valB = (b.name || b.username).toLowerCase();

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        return data;
    }, [filteredStudents, sortConfig, onlineFirst]);

    const handleAction = async (action, payload, successMessage) => {
        const execute = async () => {
            try {
                const res = await fetch('/api/control/actions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, ...payload })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message || 'Aksi gagal');
                toast.success(successMessage || data.message || 'Aksi berhasil dijalankan');
                fetchStatus();
                setModalConfig(prev => ({ ...prev, isOpen: false }));
            } catch (e) {
                toast.error(e.message);
                setModalConfig({
                    isOpen: true,
                    type: 'alert',
                    title: 'Error',
                    message: e.message,
                    isDestructive: true
                });
            }
        };

        if (action === 'reset_exam') {
            setModalConfig({
                isOpen: true,
                type: 'confirm',
                title: 'Data Siswa Terhapus',
                targetName: payload.studentName,
                message: 'Peringatan: Tindakan ini akan menghapus progres pengerjaan siswa yang sedang berjalan dan mengeluarkan mereka secara paksa. Lanjutkan?',
                isDestructive: true,
                onConfirm: execute
            });
            return;
        }

        if (action === 'force_logout') {
            setModalConfig({
                isOpen: true,
                type: 'confirm',
                title: 'Konfirmasi Logout Paksa',
                targetName: payload.studentName,
                message: 'Siswa akan dikeluarkan secara paksa dari sistem dan harus login kembali. Progres jawaban yang sudah tersimpan tetap aman. Apakah Anda yakin?',
                isDestructive: true,
                onConfirm: execute
            });
            return;
        }

        if (action === 'force_submit') {
            setModalConfig({
                isOpen: true,
                type: 'confirm',
                title: 'Paksa Kumpulkan Jawaban',
                targetName: payload.studentName,
                message: 'Tindakan ini akan segera mengakhiri sesi pengerjaan siswa dan menarik semua jawaban yang ada ke server. Proses ini tidak dapat dibatalkan.',
                isDestructive: true,
                onConfirm: execute
            });
            return;
        }

        if (action === 'unlock_exam') {
             setModalConfig({
                isOpen: true,
                type: 'confirm',
                title: 'Buka Kunci Pelanggaran',
                targetName: payload.studentName,
                message: 'Siswa ini terdeteksi melanggar keamanan. Anda ingin membuka kunci agar mereka bisa melanjutkan ujian?',
                isDestructive: false,
                onConfirm: execute
            });
            return;
        }

        if (action === 'lock_login') {
            execute();
            return;
        }

        execute();
    };

    const handleAddTime = (userId, attemptId, studentName) => {
        setModalConfig({
            isOpen: true,
            type: 'prompt',
            title: 'Tambah Waktu Ujian',
            targetName: studentName,
            message: 'Masukkan jumlah menit yang ingin ditambahkan ke sisa waktu siswa.',
            inputValue: '10',
            onConfirm: (val) => {
                const mins = parseInt(val);
                if (!isNaN(mins) && mins > 0) handleAction('add_time', { userId, attemptId, minutes: mins });
            }
        });
    };

    const handleBatchAction = async (action) => {
        const active = activeStudents;
        if (active.length === 0) {
            setModalConfig({
                isOpen: true,
                type: 'alert',
                title: 'Tidak Ada Siswa Aktif',
                message: 'Tidak ditemukan siswa yang sedang mengerjakan ujian pada filter saat ini, sehingga aksi massal tidak dapat dijalankan.',
                isDestructive: false
            });
            return;
        }
        
        if (action === 'add_time_batch') {
            setModalConfig({
                isOpen: true,
                type: 'prompt',
                title: 'Tambah Waktu Massal',
                targetName: `${active.length} Siswa Aktif`,
                message: `Menambah waktu untuk ${active.length} siswa yang sedang mengerjakan ujian. Waktu ditambahkan ke sisa waktu masing-masing siswa.`,
                inputValue: '10',
                onConfirm: (val) => {
                    const mins = parseInt(val);
                    if (!isNaN(mins) && mins > 0) handleAction(action, { attemptIds: active.map(s => s.attempt_id), minutes: mins });
                }
            });
        } else if (action === 'refresh_exams_all') {
            setModalConfig({
                isOpen: true,
                type: 'confirm',
                title: 'Segarkan Alert Semua Siswa',
                targetName: `${active.length} Siswa Aktif`,
                message: `Sinyal refresh dikirim ke ${active.length} siswa aktif agar tampilan dan alert di perangkatnya diperbarui. Progres jawaban tidak berubah.`,
                isDestructive: false,
                onConfirm: () => handleAction(action, {}, 'Sinyal refresh dikirim ke semua siswa aktif')
            });
        } else if (action === 'force_submit_all') {
            setModalConfig({
                isOpen: true,
                type: 'confirm',
                title: 'Paksa Kumpulkan Semua Jawaban',
                targetName: `${active.length} Siswa Aktif`,
                message: `PERINGATAN: ${active.length} siswa aktif akan langsung menyelesaikan ujian dan jawabannya ditarik ke server. Tindakan ini tidak dapat dibatalkan.`,
                isDestructive: true,
                onConfirm: () => handleAction(action, {}, 'Jawaban siswa berhasil dikumpulkan')
            });
        }
    };

    const batchActions = [
        {
            key: 'add_time_batch',
            label: 'Tambah Waktu',
            desc: 'Tambah menit untuk semua siswa yang sedang ujian',
            icon: PlusCircle,
            className: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'
        },
        {
            key: 'refresh_exams_all',
            label: 'Refresh Alert',
            desc: 'Kirim sinyal refresh tampilan ke siswa aktif',
            icon: BellRing,
            className: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 dark:shadow-none'
        },
        {
            key: 'force_submit_all',
            label: 'Paksa Kumpul',
            desc: 'Akhiri sesi ujian semua siswa aktif',
            icon: CheckCircle2,
            className: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200 dark:shadow-none'
        },
    ];

    if (loading && students.length === 0) return <div className="p-10 text-center text-slate-500">Loading Control Panel...</div>;

    return (
        <div className="space-y-6">
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

            {logStudent && <LogPanel student={logStudent} sseLog={sseLog} onClose={() => setLogStudent(null)} />}
            {showGuide && <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />}

            <div className="animate-fade-in-down relative overflow-hidden rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70 text-slate-800 dark:text-slate-200">
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/70 dark:from-slate-800 dark:via-slate-800 dark:to-indigo-950/20" />
                <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />

                <div className="relative p-5 border-b border-slate-100 dark:border-slate-700 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                        <span className="shrink-0 grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/25">
                            <Users size={20} />
                        </span>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                                 Exam Control
                            </h1>
                            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className="tabular-nums">
                                    Update: <span className="text-slate-700 dark:text-slate-300 font-bold">{lastUpdated.toLocaleTimeString('id-ID', { timeZone: appTimezone })}</span>
                                </span>
                                {/* Status koneksi = warna. Hijau streaming, amber
                                    reconnecting, merah putus - jadi masalahnya
                                    kelihatan tanpa baca teks. */}
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-bold uppercase ${
                                    sseStatus === 'connected'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                                        : sseStatus === 'connecting'
                                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60 animate-pulse'
                                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                                }`}>
                                    <span className={`relative flex h-1.5 w-1.5 ${
                                        sseStatus === 'connected' ? '' : sseStatus === 'connecting' ? '' : ''
                                    }`}>
                                        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                                            sseStatus === 'connected' ? 'bg-emerald-500' : sseStatus === 'connecting' ? 'bg-amber-500' : 'bg-rose-500'
                                        }`} />
                                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                                            sseStatus === 'connected' ? 'bg-emerald-500' : sseStatus === 'connecting' ? 'bg-amber-500' : 'bg-rose-500'
                                        }`} />
                                    </span>
                                    {sseStatus === 'connected' ? 'Streaming' : sseStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="relative flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
                        <div className="relative w-full sm:w-64 group">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Icons.Refresh />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Cari nama atau username..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm w-full outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-colors" 
                            />
                        </div>
                        <select 
                            value={selectedClass} 
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm w-full sm:w-40 outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-colors"
                        >
                            {classes.map(c => <option key={c} value={c}>{c === 'All' ? 'Semua Kelas' : c}</option>)}
                        </select>
                        <button 
                            onClick={() => {
                                setOnlineFirst(prev => !prev);
                                // Matikan sort kolom agar langsung kembali normal
                                if (onlineFirst) setSortConfig({ key: 'name', direction: 'asc' });
                            }} 
                            className={`p-2 border rounded-xl transition-all flex items-center gap-2 active:scale-95 ${
                                onlineFirst 
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200 dark:shadow-none' 
                                : 'bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                            }`}
                        >
                            <Users size={18} />
                            <span className="text-xs font-bold hidden sm:inline">
                                {onlineFirst ? 'Online First: ON' : 'Online First'}
                            </span>
                            {onlineFirst && <span className="hidden sm:inline w-1.5 h-1.5 rounded-full bg-white" />}
                        </button>
                        <button 
                            onClick={fetchStatus} 
                            className="p-2 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-xl transition-all flex items-center gap-2 text-slate-600 dark:text-slate-300"
                        >
                            <RefreshCcw size={18} />
                            <span className="text-xs font-bold hidden sm:inline">Refresh</span>
                        </button>
                        <button 
                            onClick={() => setShowGuide(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all"
                        >
                            <HelpCircle size={15} />
                            <span className="hidden sm:inline">Panduan</span>
                        </button>
                    </div>
                </div>

                {/* Aksi Massal */}
                <div className="relative px-5 py-4 bg-indigo-50/40 dark:bg-indigo-950/15 border-b border-slate-100 dark:border-slate-700 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                    {/* Ringkasan angka sebagai chip berwarna: jumlah siswa jadi
                        informasi, bukan sekadar teks. */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                            {filteredStudents.length} <span className="font-medium text-slate-500 dark:text-slate-400">Siswa Terfilter</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                            {filteredStudents.filter(s => s.is_online).length} <span className="font-medium">Online</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 text-xs font-bold text-sky-700 dark:text-sky-300 tabular-nums">
                            {activeStudents.length} <span className="font-medium">Sedang Ujian</span>
                        </span>
                    </div>

                    <div className="flex flex-col gap-2 w-full xl:w-auto">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider text-slate-400">Aksi Massal</span>
                            {batchActions.map(batch => {
                                const Icon = batch.icon;
                                const disabled = activeStudents.length === 0;
                                return (
                                    <button
                                        key={batch.key}
                                        onClick={() => handleBatchAction(batch.key)}
                                        disabled={disabled}
                                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${batch.className}`}
                                    >
                                        <Icon size={15} />
                                        {batch.label}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            Berlaku untuk <span className="font-bold text-slate-700 dark:text-slate-300">{activeStudents.length} siswa</span> yang sedang ujian • Tambah Waktu: menambah menit ke sisa waktu • Refresh Alert: memperbarui tampilan di perangkat siswa • Paksa Kumpul: mengakhiri sesi ujian (tidak dapat dibatalkan)
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabel Desktop */}
            <div className="animate-fade-in-up hidden md:block rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70 overflow-visible" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                    <thead className="bg-gradient-to-r from-sky-50/80 to-indigo-50/80 dark:from-sky-950/30 dark:to-indigo-950/30">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-sky-800 dark:text-sky-300 uppercase cursor-pointer group" onClick={() => toggleSort('name')}>
                                Student <SortIcon columnKey="name" />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-sky-800 dark:text-sky-300 uppercase cursor-pointer group" onClick={() => { setOnlineFirst(false); toggleSort('is_online'); }}>
                                Status <SortIcon columnKey="is_online" />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-sky-800 dark:text-sky-300 uppercase">Aktivitas &amp; Timer</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-sky-800 dark:text-sky-300 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                        {sortedStudents.map(s => (
                            <tr key={s.id} className={`hover:bg-sky-50/60 dark:hover:bg-sky-950/20 transition-colors ${s.is_online ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        {/* Titik online berkedip supaya status koneksi
                                            langsung terlihat di ujung baris. */}
                                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                                            {s.is_online && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />}
                                            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.is_online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                        </span>
                                        <div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white uppercase truncate max-w-[150px]">{s.name || s.username}</div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{s.class_name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex flex-col gap-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border w-fit ${s.is_online
                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                                            {s.is_online ? 'Online' : 'Offline'}
                                        </span>
                                        {s.is_locked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 w-fit uppercase">Locked</span>}
                                        {s.is_violation_locked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 w-fit uppercase">Violation</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {s.current_exam ? (
                                        <div className="space-y-1.5">
                                            <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">{s.current_exam}</div>
                                            {s.seconds_left !== null && <StudentTimer secondsLeft={s.seconds_left} />}
                                            {s.in_progress_count > 1 && (
                                                <div
                                                    title={`Siswa ini sedang mengerjakan ${s.in_progress_count} ujian sekaligus`}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[9px] font-bold uppercase tracking-wide border border-amber-200 dark:border-amber-900/60"
                                                >
                                                    +{s.in_progress_count - 1} ujian lain
                                                </div>
                                            )}
                                        </div>
                                    ) : <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Idle</span>}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                        <ActionButton
                                            metaKey="toggle_login_lock"
                                            icon={s.is_locked ? Icons.Lock : Icons.Unlock}
                                            tone={s.is_locked ? 'red' : 'slate'}
                                            onClick={() => handleAction('lock_login', { userId: s.id, studentName: s.name || s.username })}
                                        />
                                        <ActionButton
                                            metaKey="force_logout"
                                            icon={Icons.Logout}
                                            tone="slate"
                                            onClick={() => handleAction('force_logout', { userId: s.id, studentName: s.name || s.username })}
                                        />
                                        {s.current_exam && (
                                            <>
                                                <ActionButton
                                                    metaKey="view_logs"
                                                    icon={Icons.Log}
                                                    tone="indigo"
                                                    onClick={() => setLogStudent(s)}
                                                />
                                                {s.is_violation_locked && (
                                                    <ActionButton
                                                        metaKey="unlock_violation"
                                                        icon={Icons.Unlock}
                                                        tone="amber"
                                                        pulse
                                                        onClick={() => handleAction('unlock_exam', { userId: s.id, attemptId: s.attempt_id, studentName: s.name || s.username })}
                                                    />
                                                )}
                                                <ActionButton
                                                    metaKey="add_time"
                                                    icon={Icons.Clock}
                                                    tone="emerald"
                                                    onClick={() => handleAddTime(s.id, s.attempt_id, s.name || s.username)}
                                                />
                                                <ActionButton
                                                    metaKey="force_submit"
                                                    icon={FileSpreadsheet}
                                                    tone="rose"
                                                    onClick={() => handleAction('force_submit', { userId: s.id, attemptId: s.attempt_id, studentName: s.name || s.username })}
                                                />
                                                <ActionButton
                                                    metaKey="reset_exam"
                                                    icon={Icons.Stop}
                                                    tone="red"
                                                    onClick={() => handleAction('reset_exam', { userId: s.id, attemptId: s.attempt_id, studentName: s.name || s.username })}
                                                />
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Kartu Mobile */}
            <div className="animate-fade-in-up md:hidden space-y-3" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
                {sortedStudents.map(s => (
                    <div key={s.id} className={`relative overflow-hidden rounded-2xl border p-4 space-y-3 ring-1 transition-all duration-200 ${
                        s.is_online
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/50 ring-emerald-500/10'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 ring-slate-200/70 dark:ring-slate-800/70'
                    }`}>
                        {/* Strip tipis di tepi kiri menandai siswa yang online. */}
                        {s.is_online && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-500" />}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className="relative flex h-2.5 w-2.5 shrink-0">
                                    {s.is_online && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />}
                                    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.is_online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                </span>
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-slate-900 dark:text-white uppercase truncate">{s.name || s.username}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{s.class_name}</div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1 justify-end shrink-0">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${s.is_online
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                                    {s.is_online ? 'Online' : 'Offline'}
                                </span>
                                {s.is_locked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">Locked</span>}
                                {s.is_violation_locked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">Violation</span>}
                            </div>
                        </div>

                        {s.current_exam ? (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2 bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-900/50 rounded-xl px-3 py-2">
                                    <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 truncate">{s.current_exam}</div>
                                    {s.seconds_left !== null && <StudentTimer secondsLeft={s.seconds_left} />}
                                </div>
                                {s.in_progress_count > 1 && (
                                    <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                        Siswa ini masih membuka {s.in_progress_count - 1} ujian lain sekaligus.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl px-3 py-2">Idle — tidak sedang mengerjakan ujian</div>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                            <ActionButton
                                metaKey="toggle_login_lock"
                                icon={s.is_locked ? Icons.Lock : Icons.Unlock}
                                tone={s.is_locked ? 'red' : 'slate'}
                                onClick={() => handleAction('lock_login', { userId: s.id, studentName: s.name || s.username })}
                            />
                            <ActionButton
                                metaKey="force_logout"
                                icon={Icons.Logout}
                                tone="slate"
                                onClick={() => handleAction('force_logout', { userId: s.id, studentName: s.name || s.username })}
                            />
                            {s.current_exam && (
                                <>
                                    <ActionButton
                                        metaKey="view_logs"
                                        icon={Icons.Log}
                                        tone="indigo"
                                        onClick={() => setLogStudent(s)}
                                    />
                                    {s.is_violation_locked && (
                                        <ActionButton
                                            metaKey="unlock_violation"
                                            icon={Icons.Unlock}
                                            tone="amber"
                                            pulse
                                            onClick={() => handleAction('unlock_exam', { userId: s.id, attemptId: s.attempt_id, studentName: s.name || s.username })}
                                        />
                                    )}
                                    <ActionButton
                                        metaKey="add_time"
                                        icon={Icons.Clock}
                                        tone="emerald"
                                        onClick={() => handleAddTime(s.id, s.attempt_id, s.name || s.username)}
                                    />
                                    <ActionButton
                                        metaKey="force_submit"
                                        icon={FileSpreadsheet}
                                        tone="rose"
                                        onClick={() => handleAction('force_submit', { userId: s.id, attemptId: s.attempt_id, studentName: s.name || s.username })}
                                    />
                                    <ActionButton
                                        metaKey="reset_exam"
                                        icon={Icons.Stop}
                                        tone="red"
                                        onClick={() => handleAction('reset_exam', { userId: s.id, attemptId: s.attempt_id, studentName: s.name || s.username })}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination / Empty State */}
            {sortedStudents.length === 0 && (
                <div className="animate-fade-in-up bg-white dark:bg-slate-800 p-12 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
                    <p className="text-slate-400 italic">Tidak ada siswa ditemukan.</p>
                </div>
            )}

            {modalConfig.isOpen && (
                <UnifiedModal
                    config={modalConfig}
                    onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                />
            )}
        </div>
    );
}

// --- Unified Modal Component ---
function UnifiedModal({ config, onClose }) {
    const [localValue, setLocalValue] = useState(config.inputValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (config.type === 'prompt') {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [config.type]);

    if (!config.isOpen) return null;

    const handleConfirm = () => {
        if (config.onConfirm) {
            config.onConfirm(localValue);
        } else {
            onClose();
        }
    };

    const isPrompt = config.type === 'prompt';
    const isInvalidPrompt = isPrompt && (!parseInt(localValue) || parseInt(localValue) <= 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Strip mengikuti sifat aksi: destruktif = merah, biasa = indigo. */}
                <div aria-hidden className={`h-1 w-full bg-gradient-to-r ${
                    config.isDestructive ? 'from-rose-500 to-pink-500' : 'from-indigo-500 to-violet-500'
                }`} />
                <div className="p-8">
                    {/* Header Icon */}
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 ${
                        config.isDestructive ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                    }`}>
                        {config.isDestructive ? (
                             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        ) : (
                             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                    </div>
                    
                    <h3 className={`text-xl font-black text-center tracking-tight mb-2 ${config.isDestructive ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-white'}`}>
                        {config.title}
                    </h3>
                    
                    {config.targetName && (
                        <div className="flex items-center justify-center mb-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                                config.isDestructive
                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                                    : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60'
                            }`}>
                                {config.targetName}
                            </span>
                        </div>
                    )}

                    <p className="text-sm text-center text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                        {config.message}
                    </p>

                    {isPrompt && (
                        <div className="mt-6 space-y-4">
                            <div className="relative">
                                <input
                                    ref={inputRef}
                                    type="number"
                                    min="1"
                                    value={localValue}
                                    onChange={(e) => setLocalValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !isInvalidPrompt) handleConfirm(); }}
                                    className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-700/50 border-2 rounded-2xl text-center text-lg font-black focus:ring-0 outline-none transition-all dark:text-white ${isInvalidPrompt ? 'border-rose-300 dark:border-rose-800' : 'border-slate-100 dark:border-slate-600 focus:border-indigo-500'}`}
                                    placeholder="0"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">Menit</span>
                            </div>
                           
                            <div className="grid grid-cols-3 gap-2">
                                {[5, 10, 30].map(val => (
                                    <button
                                        key={val}
                                        onClick={() => setLocalValue(val.toString())}
                                        className={`py-2 rounded-xl text-xs font-black border-2 transition-all ${
                                            localValue === val.toString()
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                                            : 'border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        +{val}m
                                    </button>
                                ))}
                            </div>

                            <p className="text-[11px] text-center text-slate-400">
                                {isInvalidPrompt ? 'Masukkan angka menit yang lebih besar dari 0.' : `Total tambahan waktu: ${parseInt(localValue) || 0} menit`}
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                    {config.type !== 'alert' && (
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            Batal
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        disabled={isInvalidPrompt}
                        className={`flex-1 px-4 py-3 rounded-2xl text-sm font-black transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                            config.isDestructive
                            ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-300/60 dark:shadow-rose-950/50'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-300/60 dark:shadow-indigo-950/50'
                        }`}
                    >
                        {config.type === 'alert' ? 'Mengerti' : 'Lanjutkan'}
                    </button>
                </div>
            </div>
        </div>
    );
}