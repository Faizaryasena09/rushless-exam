import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import os from 'os';
import { exec } from 'child_process';
import { readFileSync } from 'fs';

async function getSession() {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

// Store previous CPU times to calculate usage between calls
let prevCpuTimes = null;

function getCpuUsage() {
    const cpus = os.cpus();
    const currentTimes = cpus.map(cpu => ({
        idle: cpu.times.idle,
        total: cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq,
    }));

    let perCore = [];
    let overallUsage = 0;

    if (prevCpuTimes && prevCpuTimes.length === currentTimes.length) {
        perCore = currentTimes.map((curr, i) => {
            const prev = prevCpuTimes[i];
            const idleDiff = curr.idle - prev.idle;
            const totalDiff = curr.total - prev.total;
            const usage = totalDiff > 0 ? ((1 - idleDiff / totalDiff) * 100) : 0;
            return Math.round(usage * 10) / 10;
        });
        overallUsage = perCore.length > 0
            ? Math.round((perCore.reduce((a, b) => a + b, 0) / perCore.length) * 10) / 10
            : 0;
    }

    prevCpuTimes = currentTimes;

    return { overall: overallUsage, perCore };
}

// ---- Lightweight bandwidth tracking ----
// Cached result — updated by background timer (Windows) or direct read (Linux)
let cachedBandwidth = null;
let prevNetBytes = null;
let prevNetTime = null;

function readNetBytesLinux() {
    try {
        const data = readFileSync('/proc/net/dev', 'utf-8');
        const lines = data.split('\n').slice(2);
        let rx = 0, tx = 0;
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 10) {
                rx += parseInt(parts[1]) || 0;
                tx += parseInt(parts[9]) || 0;
            }
        }
        return { rx, tx };
    } catch {
        return null;
    }
}

function updateBandwidth(totalRx, totalTx) {
    const now = Date.now();
    let rxPerSec = 0, txPerSec = 0;

    if (prevNetBytes && prevNetTime) {
        const elapsed = (now - prevNetTime) / 1000;
        if (elapsed > 0.5) {
            rxPerSec = Math.max(0, (totalRx - prevNetBytes.rx) / elapsed);
            txPerSec = Math.max(0, (totalTx - prevNetBytes.tx) / elapsed);
        }
    }

    prevNetBytes = { rx: totalRx, tx: totalTx };
    prevNetTime = now;

    cachedBandwidth = {
        totalReceived: totalRx,
        totalSent: totalTx,
        rxPerSec: Math.round(rxPerSec),
        txPerSec: Math.round(txPerSec),
    };
}

// Windows: async background poll every 5s (no blocking execSync)
let winBwTimer = null;
function startWindowsBandwidthPoller() {
    if (winBwTimer) return;
    const poll = () => {
        exec(
            'netstat -e',
            { encoding: 'utf-8', timeout: 4000 },
            (err, stdout) => {
                if (err || !stdout) return;
                // Parse netstat -e output: "Bytes  <received>  <sent>"
                const lines = stdout.split('\n');
                for (const line of lines) {
                    if (line.toLowerCase().includes('bytes')) {
                        const nums = line.match(/[\d]+/g);
                        if (nums && nums.length >= 2) {
                            updateBandwidth(parseInt(nums[0]), parseInt(nums[1]));
                        }
                        break;
                    }
                }
            }
        );
    };
    poll();
    winBwTimer = setInterval(poll, 5000);
}

function getNetworkBandwidth() {
    const platform = os.platform();
    if (platform === 'win32') {
        // Start background poller if not running; return cached value
        startWindowsBandwidthPoller();
        return cachedBandwidth;
    } else {
        // Linux: direct /proc/net/dev read is instant, safe every 1s
        const bytes = readNetBytesLinux();
        if (!bytes) return null;
        updateBandwidth(bytes.rx, bytes.tx);
        return cachedBandwidth;
    }
}

export async function GET(request) {
    const session = await getSession();
    if (!session.user || session.user.roleName !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized: Admin only' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'full'; // 'full' or 'realtime'

    try {
        const cpuUsage = getCpuUsage();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const processMemory = process.memoryUsage();

        // Realtime mode: return only frequently changing metrics (lightweight)
        if (mode === 'realtime') {
            const bandwidth = getNetworkBandwidth();
            return NextResponse.json({
                cpu: cpuUsage,
                memory: {
                    total: totalMemory,
                    used: usedMemory,
                    free: freeMemory,
                    usagePercent: parseFloat(((usedMemory / totalMemory) * 100).toFixed(1)),
                },
                processMemory: {
                    heapUsed: processMemory.heapUsed,
                    heapTotal: processMemory.heapTotal,
                    rss: processMemory.rss,
                    external: processMemory.external,
                },
                bandwidth,
                uptime: os.uptime(),
                serverTime: new Date().toISOString(),
            });
        }

        // Full mode: return everything
        const uptimeSeconds = os.uptime();
        const cpus = os.cpus();

        const systemInfo = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            nodeVersion: process.version,
            uptime: {
                days: Math.floor(uptimeSeconds / 86400),
                hours: Math.floor((uptimeSeconds % 86400) / 3600),
                minutes: Math.floor((uptimeSeconds % 3600) / 60),
                seconds: Math.floor(uptimeSeconds % 60),
                raw: uptimeSeconds,
            },
            memory: {
                total: totalMemory,
                used: usedMemory,
                free: freeMemory,
                usagePercent: parseFloat(((usedMemory / totalMemory) * 100).toFixed(1)),
            },
            cpu: {
                model: cpus[0]?.model || 'Unknown',
                cores: cpus.length,
                speed: cpus[0]?.speed || 0,
                usage: cpuUsage,
            },
            processMemory,
            pid: process.pid,
            network: (() => {
                const nets = os.networkInterfaces();
                const adapters = [];
                for (const [name, interfaces] of Object.entries(nets)) {
                    for (const iface of interfaces) {
                        adapters.push({
                            adapter: name,
                            address: iface.address,
                            netmask: iface.netmask,
                            family: iface.family,
                            mac: iface.mac,
                            internal: iface.internal,
                            cidr: iface.cidr,
                        });
                    }
                }
                return adapters;
            })(),
        };

        // Database Information
        const [dbVersion] = await query({ query: 'SELECT VERSION() as version' });
        const dbStatus = await query({ query: 'SHOW STATUS WHERE Variable_name IN ("Uptime", "Threads_connected", "Questions", "Slow_queries", "Connections")' });

        const dbStatusMap = {};
        dbStatus.forEach(row => {
            dbStatusMap[row.Variable_name] = row.Value;
        });

        const tableStats = await query({
            query: `SELECT TABLE_NAME as tableName, TABLE_ROWS as rowCount, 
                    ROUND(DATA_LENGTH / 1024, 2) as dataSizeKB,
                    ROUND(INDEX_LENGTH / 1024, 2) as indexSizeKB,
                    ENGINE as engine
                    FROM information_schema.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'rhs_%'
                    ORDER BY TABLE_NAME`
        });

        const totalDbSize = tableStats.reduce((acc, t) => acc + (parseFloat(t.dataSizeKB) || 0) + (parseFloat(t.indexSizeKB) || 0), 0);

        const userCounts = await query({
            query: `SELECT role, COUNT(*) as count FROM rhs_users GROUP BY role`
        });

        const [examCount] = await query({ query: 'SELECT COUNT(*) as count FROM rhs_exams' });
        const [questionCount] = await query({ query: 'SELECT COUNT(*) as count FROM rhs_exam_questions' });

        const databaseInfo = {
            version: dbVersion?.version || 'Unknown',
            uptime: dbStatusMap.Uptime || '0',
            connections: dbStatusMap.Threads_connected || '0',
            totalQueries: dbStatusMap.Questions || '0',
            slowQueries: dbStatusMap.Slow_queries || '0',
            totalConnections: dbStatusMap.Connections || '0',
            tables: tableStats,
            totalSizeKB: totalDbSize.toFixed(2),
        };

        const appStats = {
            userCounts: userCounts.reduce((acc, row) => { acc[row.role] = row.count; return acc; }, {}),
            totalUsers: userCounts.reduce((acc, row) => acc + row.count, 0),
            totalExams: examCount?.count || 0,
            totalQuestions: questionCount?.count || 0,
        };

        return NextResponse.json({
            system: systemInfo,
            database: databaseInfo,
            app: appStats,
            serverTime: new Date().toISOString(),
        });

    } catch (error) {
        console.error('System info fetch failed:', error);
        return NextResponse.json({ message: 'Failed to fetch system info', error: error.message }, { status: 500 });
    }
}
