'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

// --- Constants ---
const HISTORY_LENGTH = 60; // 60 seconds of history
const POLL_INTERVAL = 1000; // 1 second

// --- Icons ---
const Icons = {
    Server: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>,
    Database: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
    Cpu: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
    Memory: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    Chart: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    Clock: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Refresh: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    Users: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    Shield: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    Play: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>,
    Activity: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Pulse: () => <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12"><circle cx="6" cy="6" r="6"><animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" /></circle></svg>,
};

// --- Utilities ---
function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
    if (!seconds) return '-';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

// --- SVG Real-time Chart Component ---
function RealtimeChart({ data, maxValue = 100, height = 120, color = '#6366f1', gradientId, label, unit = '%', showGrid = true }) {
    const w = 300;
    const h = height;
    const padding = { top: 5, bottom: 20, left: 0, right: 0 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const currentValue = data.length > 0 ? data[data.length - 1] : 0;

    const points = data.map((val, i) => {
        const x = padding.left + (i / (HISTORY_LENGTH - 1)) * chartW;
        const y = padding.top + chartH - (Math.min(val, maxValue) / maxValue) * chartH;
        return `${x},${y}`;
    });

    const areaPoints = points.length > 0
        ? `${padding.left},${padding.top + chartH} ${points.join(' ')} ${padding.left + ((data.length - 1) / (HISTORY_LENGTH - 1)) * chartW},${padding.top + chartH}`
        : '';

    const gridLines = showGrid ? [0, 25, 50, 75, 100] : [];

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {gridLines.map(pct => {
                    const y = padding.top + chartH - (pct / 100) * chartH;
                    return (
                        <g key={pct}>
                            <line x1={padding.left} y1={y} x2={w - padding.right} y2={y} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="4,4" />
                            <text x={w - padding.right - 2} y={y - 2} fill="#94a3b8" fontSize="7" textAnchor="end">{pct}{unit}</text>
                        </g>
                    );
                })}

                {/* Area fill */}
                {areaPoints && <polygon points={areaPoints} fill={`url(#${gradientId})`} />}

                {/* Line */}
                {points.length > 1 && (
                    <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                )}

                {/* Current value dot */}
                {points.length > 0 && (() => {
                    const lastPoint = points[points.length - 1].split(',');
                    return (
                        <>
                            <circle cx={lastPoint[0]} cy={lastPoint[1]} r="3" fill={color} />
                            <circle cx={lastPoint[0]} cy={lastPoint[1]} r="5" fill={color} opacity="0.3">
                                <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                            </circle>
                        </>
                    );
                })()}

                {/* Time labels */}
                <text x={padding.left + 2} y={h - 3} fill="#94a3b8" fontSize="7">-60s</text>
                <text x={w / 2} y={h - 3} fill="#94a3b8" fontSize="7" textAnchor="middle">-30s</text>
                <text x={w - padding.right - 2} y={h - 3} fill="#94a3b8" fontSize="7" textAnchor="end">now</text>
            </svg>

            {/* Current value overlay */}
            <div className="absolute top-1 left-2">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color, backgroundColor: color + '15' }}>
                    {label}: {typeof currentValue === 'number' ? currentValue.toFixed(1) : currentValue}{unit}
                </span>
            </div>
        </div>
    );
}

// --- Gauge Component ---
function GaugeChart({ value, maxValue = 100, size = 100, color = '#6366f1', label }) {
    const radius = 40;
    const circumference = 2 * Math.PI * radius * 0.75; // 270 degrees
    const progress = Math.min(value / maxValue, 1);
    const dashOffset = circumference * (1 - progress);

    const getColor = (v) => {
        if (v > 90) return '#ef4444';
        if (v > 70) return '#f59e0b';
        return color;
    };
    const activeColor = getColor(value);

    return (
        <div className="flex flex-col items-center">
            <svg width={size} height={size * 0.7} viewBox="0 0 100 70">
                {/* Background arc */}
                <path
                    d="M 10 65 A 40 40 0 1 1 90 65"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="8"
                    strokeLinecap="round"
                />
                {/* Progress arc */}
                <path
                    d="M 10 65 A 40 40 0 1 1 90 65"
                    fill="none"
                    stroke={activeColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
                />
                {/* Value text */}
                <text x="50" y="48" textAnchor="middle" fill={activeColor} fontSize="18" fontWeight="bold" fontFamily="monospace">
                    {value.toFixed(1)}%
                </text>
                <text x="50" y="62" textAnchor="middle" fill="#94a3b8" fontSize="8">
                    {label}
                </text>
            </svg>
        </div>
    );
}

// --- Per-Core Bar ---
function CoreBar({ index, value }) {
    const getColor = (v) => {
        if (v > 90) return 'bg-red-500';
        if (v > 70) return 'bg-amber-500';
        if (v > 40) return 'bg-indigo-500';
        return 'bg-emerald-500';
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-6 font-mono">{index}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${getColor(value)}`}
                    style={{ width: `${Math.min(value, 100)}%` }}
                />
            </div>
            <span className="text-xs font-mono text-slate-600 w-12 text-right">{value.toFixed(1)}%</span>
        </div>
    );
}

// --- Card Components ---
function InfoCard({ icon: Icon, title, children, className = '', live = false }) {
    return (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
            <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200">
                <span className="text-indigo-600"><Icon /></span>
                <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
                {live && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-600">
                        <Icons.Pulse /> LIVE
                    </span>
                )}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function InfoRow({ label, value, mono = false }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-500">{label}</span>
            <span className={`text-sm font-medium text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
        </div>
    );
}

function StatBadge({ label, value, color = 'indigo' }) {
    const colorMap = {
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        violet: 'bg-violet-50 text-violet-700 border-violet-200',
        sky: 'bg-sky-50 text-sky-700 border-sky-200',
    };
    return (
        <div className={`flex flex-col items-center p-4 rounded-xl border ${colorMap[color] || colorMap.indigo}`}>
            <span className="text-2xl font-bold">{value}</span>
            <span className="text-xs font-medium mt-1">{label}</span>
        </div>
    );
}

// --- Mini Sparkline ---
function Sparkline({ data, color = '#6366f1', height = 30, width = 80 }) {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (v / max) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="inline-block">
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
    );
}

// =====================================================
// MAIN PAGE COMPONENT
// =====================================================
export default function WebSettingsPage() {
    const [fullData, setFullData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [setupLoading, setSetupLoading] = useState(false);
    const [setupMessage, setSetupMessage] = useState('');
    const [isLive, setIsLive] = useState(true);

    // History arrays for graphs
    const [cpuHistory, setCpuHistory] = useState([]);
    const [memHistory, setMemHistory] = useState([]);
    const [heapHistory, setHeapHistory] = useState([]);
    const [rssHistory, setRssHistory] = useState([]);

    // Current realtime values
    const [realtime, setRealtime] = useState(null);

    const intervalRef = useRef(null);

    // Fetch full data (initial load)
    const fetchFullData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/system-info?mode=full');
            if (!res.ok) {
                if (res.status === 401) { setError('Unauthorized: Halaman ini hanya untuk Admin.'); return; }
                throw new Error('Failed to fetch');
            }
            const json = await res.json();
            setFullData(json);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch realtime data (lightweight, every 1s)
    const fetchRealtime = useCallback(async () => {
        try {
            const res = await fetch('/api/system-info?mode=realtime');
            if (!res.ok) return;
            const json = await res.json();
            setRealtime(json);

            setCpuHistory(prev => {
                const next = [...prev, json.cpu.overall];
                return next.length > HISTORY_LENGTH ? next.slice(-HISTORY_LENGTH) : next;
            });
            setMemHistory(prev => {
                const next = [...prev, json.memory.usagePercent];
                return next.length > HISTORY_LENGTH ? next.slice(-HISTORY_LENGTH) : next;
            });
            setHeapHistory(prev => {
                const heapMB = (json.processMemory.heapUsed / 1024 / 1024);
                const next = [...prev, heapMB];
                return next.length > HISTORY_LENGTH ? next.slice(-HISTORY_LENGTH) : next;
            });
            setRssHistory(prev => {
                const rssMB = (json.processMemory.rss / 1024 / 1024);
                const next = [...prev, rssMB];
                return next.length > HISTORY_LENGTH ? next.slice(-HISTORY_LENGTH) : next;
            });
        } catch {
            // silently fail for realtime polls
        }
    }, []);

    // Initial load + start polling
    useEffect(() => {
        fetchFullData();
        fetchRealtime(); // first realtime call
    }, [fetchFullData, fetchRealtime]);

    useEffect(() => {
        if (isLive) {
            intervalRef.current = setInterval(fetchRealtime, POLL_INTERVAL);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isLive, fetchRealtime]);

    const handleRunSetup = async () => {
        if (!confirm('Jalankan database migration/setup?')) return;
        setSetupLoading(true);
        setSetupMessage('');
        try {
            const res = await fetch('/api/setup');
            const result = await res.json();
            if (res.ok) {
                setSetupMessage(`✅ Setup selesai. ${result.details?.length || 0} item diproses.`);
                fetchFullData();
            } else {
                setSetupMessage(`❌ Setup gagal: ${result.message || result.error}`);
            }
        } catch (err) {
            setSetupMessage(`❌ Error: ${err.message}`);
        } finally {
            setSetupLoading(false);
        }
    };

    // --- Loading state ---
    if (loading && !fullData) {
        return (
            <div className="space-y-6">
                <div className="h-8 bg-slate-200 rounded w-1/3 animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-52 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
            </div>
        );
    }

    if (error && !fullData) {
        return (
            <div className="text-center py-20">
                <div className="inline-block text-slate-400"><Icons.Shield /></div>
                <h2 className="text-xl font-bold text-slate-800 mt-4">{error}</h2>
            </div>
        );
    }

    const { system, database, app } = fullData || {};
    const cpuUsage = realtime?.cpu?.overall ?? system?.cpu?.usage?.overall ?? 0;
    const memUsage = realtime?.memory?.usagePercent ?? system?.memory?.usagePercent ?? 0;
    const perCore = realtime?.cpu?.perCore ?? system?.cpu?.usage?.perCore ?? [];
    const currentMem = realtime?.memory ?? system?.memory ?? {};
    const currentProcess = realtime?.processMemory ?? system?.processMemory ?? {};
    const currentUptime = realtime?.uptime ?? system?.uptime?.raw ?? 0;

    const heapMax = Math.max(...heapHistory, (currentProcess.heapTotal || 0) / 1024 / 1024, 50);
    const rssMax = Math.max(...rssHistory, 100);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        System Overview
                        {isLive && <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><Icons.Pulse /> LIVE</span>}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Real-time system monitoring &amp; server overview
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsLive(!isLive)}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${isLive
                            ? 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                            : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <Icons.Activity />
                        {isLive ? 'Live: ON' : 'Live: OFF'}
                    </button>
                    <button
                        onClick={fetchFullData}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
                    >
                        <Icons.Refresh />
                        Refresh All
                    </button>
                </div>
            </div>

            {/* Realtime Overview: Big gauges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CPU Usage Graph */}
                <InfoCard icon={Icons.Cpu} title="CPU Usage" live={isLive}>
                    <div className="flex items-center gap-6 mb-4">
                        <GaugeChart value={cpuUsage} label="Overall" color="#6366f1" size={130} />
                        <div className="flex-1 text-center">
                            <div className="text-4xl font-bold font-mono text-slate-800">{cpuUsage.toFixed(1)}%</div>
                            <div className="text-sm text-slate-500 mt-1">{system?.cpu?.model}</div>
                            <div className="text-xs text-slate-400">{system?.cpu?.cores} cores @ {system?.cpu?.speed} MHz</div>
                        </div>
                    </div>
                    <RealtimeChart
                        data={cpuHistory}
                        color="#6366f1"
                        gradientId="cpuGrad"
                        label="CPU"
                        height={100}
                    />
                </InfoCard>

                {/* Memory Usage Graph */}
                <InfoCard icon={Icons.Memory} title="Memory Usage" live={isLive}>
                    <div className="flex items-center gap-6 mb-4">
                        <GaugeChart value={memUsage} label="RAM" color="#10b981" size={130} />
                        <div className="flex-1 space-y-1">
                            <InfoRow label="Total" value={formatBytes(currentMem.total)} mono />
                            <InfoRow label="Used" value={formatBytes(currentMem.used)} mono />
                            <InfoRow label="Free" value={formatBytes(currentMem.free)} mono />
                        </div>
                    </div>
                    <RealtimeChart
                        data={memHistory}
                        color="#10b981"
                        gradientId="memGrad"
                        label="RAM"
                        height={100}
                    />
                </InfoCard>
            </div>

            {/* Per-Core CPU usage */}
            {perCore.length > 0 && (
                <InfoCard icon={Icons.Cpu} title={`CPU Cores (${perCore.length} cores)`} live={isLive}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                        {perCore.map((usage, i) => (
                            <CoreBar key={i} index={i} value={usage} />
                        ))}
                    </div>
                </InfoCard>
            )}

            {/* Process Memory Graphs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoCard icon={Icons.Chart} title="Node.js Heap Memory" live={isLive}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <span className="text-2xl font-bold font-mono text-slate-800">{formatBytes(currentProcess.heapUsed)}</span>
                            <span className="text-sm text-slate-400 ml-2">/ {formatBytes(currentProcess.heapTotal)}</span>
                        </div>
                        <Sparkline data={heapHistory.slice(-20)} color="#8b5cf6" />
                    </div>
                    <RealtimeChart
                        data={heapHistory}
                        maxValue={heapMax}
                        color="#8b5cf6"
                        gradientId="heapGrad"
                        label="Heap"
                        unit=" MB"
                        height={100}
                    />
                </InfoCard>

                <InfoCard icon={Icons.Chart} title="Process RSS Memory" live={isLive}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <span className="text-2xl font-bold font-mono text-slate-800">{formatBytes(currentProcess.rss)}</span>
                            <span className="text-sm text-slate-400 ml-2">Resident Set Size</span>
                        </div>
                        <Sparkline data={rssHistory.slice(-20)} color="#f59e0b" />
                    </div>
                    <RealtimeChart
                        data={rssHistory}
                        maxValue={rssMax}
                        color="#f59e0b"
                        gradientId="rssGrad"
                        label="RSS"
                        unit=" MB"
                        height={100}
                    />
                </InfoCard>
            </div>

            {/* App Stats */}
            {app && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <StatBadge label="Total Users" value={app.totalUsers} color="indigo" />
                    <StatBadge label="Admin" value={app.userCounts?.admin || 0} color="violet" />
                    <StatBadge label="Teacher" value={app.userCounts?.teacher || 0} color="sky" />
                    <StatBadge label="Total Exams" value={app.totalExams} color="green" />
                    <StatBadge label="Questions" value={app.totalQuestions} color="amber" />
                </div>
            )}

            {/* Static Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* System Info */}
                {system && (
                    <InfoCard icon={Icons.Server} title="System Information">
                        <InfoRow label="Hostname" value={system.hostname} mono />
                        <InfoRow label="Platform" value={`${system.platform} (${system.arch})`} />
                        <InfoRow label="OS Release" value={system.release} mono />
                        <InfoRow label="Node.js" value={system.nodeVersion} mono />
                        <InfoRow label="PID" value={system.pid} mono />
                    </InfoCard>
                )}

                {/* Uptime */}
                <InfoCard icon={Icons.Clock} title="Server Uptime" live={isLive}>
                    <div className="text-center py-4">
                        <div className="text-3xl font-bold text-slate-800 font-mono">
                            {formatUptime(currentUptime)}
                        </div>
                        <p className="text-sm text-slate-500 mt-2">System uptime</p>
                    </div>
                    <div className="mt-2 pt-3 border-t border-slate-100">
                        <InfoRow label="Server Time" value={realtime?.serverTime ? new Date(realtime.serverTime).toLocaleString('id-ID') : '-'} />
                    </div>
                </InfoCard>

                {/* Database Info */}
                {database && (
                    <InfoCard icon={Icons.Database} title="Database">
                        <InfoRow label="MySQL Version" value={database.version} mono />
                        <InfoRow label="Active Connections" value={database.connections} />
                        <InfoRow label="Total Queries" value={parseInt(database.totalQueries).toLocaleString()} />
                        <InfoRow label="Slow Queries" value={database.slowQueries} />
                        <InfoRow label="DB Size" value={`${database.totalSizeKB} KB`} mono />
                    </InfoCard>
                )}
            </div>

            {/* Maintenance */}
            <InfoCard icon={Icons.Shield} title="Maintenance">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <p className="text-sm text-slate-500 flex-1">
                        Jalankan database setup/migration untuk memastikan semua tabel dan kolom terbaru ada.
                    </p>
                    <button
                        onClick={handleRunSetup}
                        disabled={setupLoading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:bg-indigo-300 whitespace-nowrap"
                    >
                        <Icons.Play />
                        {setupLoading ? 'Running...' : 'Run Database Setup'}
                    </button>
                </div>
                {setupMessage && (
                    <p className={`text-sm p-3 rounded-lg mt-3 ${setupMessage.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {setupMessage}
                    </p>
                )}
            </InfoCard>

            {/* Database Tables */}
            {database?.tables && database.tables.length > 0 && (
                <InfoCard icon={Icons.Database} title={`Database Tables (${database.tables.length})`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-2 px-3 text-slate-500 font-medium">Table</th>
                                    <th className="text-right py-2 px-3 text-slate-500 font-medium">Rows</th>
                                    <th className="text-right py-2 px-3 text-slate-500 font-medium">Data (KB)</th>
                                    <th className="text-right py-2 px-3 text-slate-500 font-medium">Index (KB)</th>
                                    <th className="text-right py-2 px-3 text-slate-500 font-medium">Engine</th>
                                </tr>
                            </thead>
                            <tbody>
                                {database.tables.map((table, idx) => (
                                    <tr key={table.tableName} className={`border-b border-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                        <td className="py-2 px-3 font-mono text-slate-700">{table.tableName}</td>
                                        <td className="py-2 px-3 text-right text-slate-600">{(table.rowCount || 0).toLocaleString()}</td>
                                        <td className="py-2 px-3 text-right font-mono text-slate-600">{table.dataSizeKB}</td>
                                        <td className="py-2 px-3 text-right font-mono text-slate-600">{table.indexSizeKB}</td>
                                        <td className="py-2 px-3 text-right text-slate-500">{table.engine}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-slate-200 font-semibold">
                                    <td className="py-2 px-3 text-slate-700">Total</td>
                                    <td className="py-2 px-3 text-right text-slate-700">
                                        {database.tables.reduce((s, t) => s + (t.rowCount || 0), 0).toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-slate-700">{database.totalSizeKB}</td>
                                    <td className="py-2 px-3" />
                                    <td className="py-2 px-3" />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </InfoCard>
            )}
        </div>
    );
}
