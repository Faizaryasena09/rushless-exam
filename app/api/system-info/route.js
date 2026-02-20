import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import os from 'os';

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
