'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown, RefreshCcw, Users, Clock, Send, FileSpreadsheet } from 'lucide-react';

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
    Refresh: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" /></svg>,
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

// --- Student Timer ---
function StudentTimer({ secondsLeft }) {
    const [display, setDisplay] = useState(secondsLeft);

    useEffect(() => {
        setDisplay(secondsLeft);
    }, [secondsLeft]);

    useEffect(() => {
        if (display === null || display <= 0) return;
        const t = setTimeout(() => setDisplay(prev => Math.max(0, prev - 1)), 1000);
        return () => clearTimeout(t);
    }, [display]);

    const isCritical = display !== null && display <= 300;
    const isExpired = display === 0;

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

// --- Log Panel ---
function LogPanel({ student, onClose, sseLog }) {
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

    const formatTime = (ts) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 flex-shrink-0">
                    <div>
                        <h2 className="font-bold text-slate-800 dark:text-white text-sm">Log Realtime</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {student.name || student.username} — <span className="font-medium text-indigo-600">{student.current_exam}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Live
                        </span>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"><Icons.X /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
                    {loading && logs.length === 0 && <div className="text-center text-slate-400 py-10">Memuat log...</div>}
                    {!loading && logs.length === 0 && <div className="text-center text-slate-400 py-10">Belum ada log untuk sesi ini.</div>}
                    {logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-2">
                            <span className="text-slate-400 whitespace-nowrap flex-shrink-0 pt-0.5">{formatTime(log.created_at)}</span>
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

export default function ControlPanel() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [sseStatus, setSseStatus] = useState('connecting');
    const [redisActive, setRedisActive] = useState(true);
    const [logStudent, setLogStudent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('All');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [sseLog, setSseLog] = useState(null);

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
    const filteredStudents = students.filter(student => {
        const matchesClass = selectedClass === 'All' || student.class_name === selectedClass;
        const matchesSearch = student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              student.username?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesClass && matchesSearch;
    });

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
    }, [filteredStudents, sortConfig]);

    const handleAction = async (action, payload) => {
        if (action === 'reset_exam' && !confirm('Warning: This will delete the student\'s active exam attempt and log them out. Continue?')) return;
        if (action === 'force_logout' && !confirm('Force logout this user?')) return;
        try {
            const res = await fetch('/api/control/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload })
            });
            if (!res.ok) throw new Error((await res.json()).message);
            fetchStatus();
        } catch (e) { alert(e.message); }
    };

    const handleAddTime = (userId, attemptId) => {
        const minutes = prompt("Enter minutes to add:", "10");
        if (minutes && !isNaN(minutes)) handleAction('add_time', { userId, attemptId, minutes: parseInt(minutes) });
    };

    const handleBatchAction = async (action, payload) => {
        const active = filteredStudents.filter(s => s.attempt_id);
        if (active.length === 0) { alert("None of the currently filtered students are active."); return; }
        
        if (action === 'add_time_batch') {
            const minutes = prompt(`Enter minutes to add for ${active.length} student(s):`, "10");
            if (minutes && !isNaN(minutes)) handleAction(action, { attemptIds: active.map(s => s.attempt_id), minutes: parseInt(minutes) });
        } else if (action === 'refresh_exams_all' || action === 'force_submit_all') {
            if (confirm(`${action.replace('_all', '').replace('_', ' ').toUpperCase()} for ${active.length} student(s)?`)) {
                handleAction(action, {});
            }
        }
    };

    if (loading && students.length === 0) return <div className="p-10 text-center text-slate-500">Loading Control Panel...</div>;

    return (
        <div className="space-y-6">
            {logStudent && <LogPanel student={logStudent} sseLog={sseLog} onClose={() => setLogStudent(null)} />}

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden text-slate-800 dark:text-slate-200">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/30 dark:bg-slate-700/30">
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                             Exam Control
                        </h1>
                        <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-2 ml-1">
                            Update: <span className="text-slate-700 dark:text-slate-300 font-bold">{lastUpdated.toLocaleTimeString('id-ID')}</span>
                            <span className={`flex items-center gap-1 ml-2 font-bold uppercase ${
                                sseStatus === 'connected' ? 'text-emerald-500' : 
                                sseStatus === 'connecting' ? 'text-amber-500 animate-pulse' : 
                                'text-rose-500'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                    sseStatus === 'connected' ? 'bg-emerald-500' : 
                                    sseStatus === 'connecting' ? 'bg-amber-500' : 
                                    'bg-rose-500'
                                }`}></span>
                                {sseStatus === 'connected' ? 'Streaming' : sseStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                            </span>
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
                        <div className="relative w-full sm:w-64 group">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Icons.Refresh />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Cari nama atau username..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-indigo-500/20" 
                            />
                        </div>
                        <select 
                            value={selectedClass} 
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm w-full sm:w-40 outline-none"
                        >
                            {classes.map(c => <option key={c} value={c}>{c === 'All' ? 'Semua Kelas' : c}</option>)}
                        </select>
                        <button 
                            onClick={() => toggleSort('is_online')} 
                            className={`p-2 border rounded-xl transition-all flex items-center gap-2 ${
                                sortConfig.key === 'is_online' 
                                ? 'bg-indigo-600 text-white border-indigo-600' 
                                : 'bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                            }`}
                            title="Urutkan berdasarkan status online"
                        >
                            <Users size={18} />
                            <span className="text-xs font-bold hidden sm:inline">Online First</span>
                        </button>
                        <button onClick={fetchStatus} className="p-2 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-xl transition-all">
                            <RefreshCcw size={18} />
                        </button>
                    </div>
                </div>

                <div className="px-5 py-3 bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {filteredStudents.length} <span className="text-slate-400 font-medium">Siswa Terfilter</span>
                        </div>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {filteredStudents.filter(s => s.is_online).length} <span className="text-slate-400 font-medium text-emerald-500">Online</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => handleBatchAction('add_time_batch')} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase">Tambah Waktu</button>
                        <button onClick={() => handleBatchAction('refresh_exams_all')} className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold uppercase">Refresh Alert</button>
                        <button onClick={() => handleBatchAction('force_submit_all')} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold uppercase">Paksa Kumpul</button>
                    </div>
                </div>
            </div>

            <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50/80 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase cursor-pointer" onClick={() => toggleSort('name')}>
                                Student <SortIcon columnKey="name" />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase cursor-pointer" onClick={() => toggleSort('is_online')}>
                                Status <SortIcon columnKey="is_online" />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Aktivitas & Timer</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {sortedStudents.map(s => (
                            <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${s.is_online ? 'bg-indigo-50/10 dark:bg-indigo-900/5' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-2.5 w-2.5 rounded-full ${s.is_online ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white uppercase truncate max-w-[150px]">{s.name || s.username}</div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{s.class_name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex flex-col gap-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${s.is_online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {s.is_online ? 'Online' : 'Offline'}
                                        </span>
                                        {s.is_locked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 w-fit uppercase">Locked</span>}
                                        {s.is_violation_locked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 w-fit uppercase border border-amber-200">Violation</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {s.current_exam ? (
                                        <div className="space-y-1">
                                            <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">{s.current_exam}</div>
                                            {s.seconds_left !== null && <StudentTimer secondsLeft={s.seconds_left} />}
                                        </div>
                                    ) : <span className="text-[11px] text-slate-400">Idle</span>}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <button onClick={() => handleAction('lock_login', { userId: s.id })} className={`p-2 rounded-lg ${s.is_locked ? 'bg-red-100 text-red-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`} title="Lock/Unlock Login">
                                            {s.is_locked ? <Icons.Lock /> : <Icons.Unlock />}
                                        </button>
                                        <button onClick={() => handleAction('force_logout', { userId: s.id })} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 rounded-lg" title="Force Logout">
                                            <Icons.Logout />
                                        </button>
                                        {s.current_exam && (
                                            <>
                                                <button onClick={() => setLogStudent(s)} className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg" title="View Logs">
                                                    <Icons.Log />
                                                </button>
                                                {s.is_violation_locked && (
                                                    <button onClick={() => handleAction('unlock_exam', { userId: s.id, attemptId: s.attempt_id })} className="p-2 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg animate-pulse" title="Unlock Violation">
                                                        <Icons.Unlock />
                                                    </button>
                                                )}
                                                <button onClick={() => handleAddTime(s.id, s.attempt_id)} className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded-lg" title="Add Time">
                                                    <Icons.Clock />
                                                </button>
                                                <button onClick={() => handleAction('force_submit', { userId: s.id, attemptId: s.attempt_id })} className="p-2 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg" title="Force Submit">
                                                    <FileSpreadsheet size={16} />
                                                </button>
                                                <button onClick={() => handleAction('reset_exam', { userId: s.id, attemptId: s.attempt_id })} className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg" title="Reset Exam">
                                                    <Icons.Stop />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination / Empty State */}
            {sortedStudents.length === 0 && (
                <div className="bg-white dark:bg-slate-800 p-12 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                    <p className="text-slate-400 italic">Tidak ada siswa ditemukan.</p>
                </div>
            )}
        </div>
    );
}
