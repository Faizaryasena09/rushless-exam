'use strict';

/**
 * Koneksi Redis untuk rhsls.
 * Redis hanya opsional: bila mati, semua perintah sesi tetap bisa jalan
 * dengan data MySQL (mode fallback, sama seperti aplikasinya).
 */

const Redis = require('ioredis');

let client = null;
let available = false;

function config() {
    return {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : 0,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        retryStrategy: () => null,
    };
}

async function getClient() {
    if (client) return client;
    client = new Redis(config());
    client.on('error', () => { available = false; });
    return client;
}

async function get(key) {
    if (!client) return null;
    try {
        const c = await getClient();
        return await c.get(key);
    } catch (e) {
        return null;
    }
}

async function ping() {
    try {
        const c = await getClient();
        const started = Date.now();
        const res = await c.ping();
        available = res === 'PONG';
        return { ok: available, latencyMs: Date.now() - started };
    } catch (e) {
        available = false;
        return { ok: false, error: e.message };
    }
}

async function isReady() {
    if (!client) return false;
    try {
        return client.status === 'ready';
    } catch (e) {
        return false;
    }
}

/** Ambil banyak key sekaligus (pakai pipeline) */
async function mgetMany(keys) {
    if (!keys.length) return {};
    const c = await getClient();
    try {
        const values = await c.mget(keys);
        const out = {};
        keys.forEach((k, i) => { out[k] = values[i]; });
        return out;
    } catch (e) {
        return {};
    }
}

async function existsMany(keys) {
    if (!keys.length) return {};
    const c = await getClient();
    const out = {};
    try {
        const pipeline = c.pipeline();
        keys.forEach((k) => pipeline.exists(k));
        const results = await pipeline.exec();
        keys.forEach((k, i) => { out[k] = results[i] && results[i][1] === 1; });
    } catch (e) {
        // ignore
    }
    return out;
}

async function del(keys) {
    if (!keys.length) return 0;
    const c = await getClient();
    let removed = 0;
    try {
        removed = await c.del(...keys);
    } catch (e) {
        // ignore
    }
    return removed;
}

async function scanKeys(pattern) {
    const c = await getClient();
    const found = [];
    let cursor = '0';
    try {
        do {
            const [next, keys] = await c.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
            cursor = next;
            found.push(...keys);
        } while (cursor !== '0');
    } catch (e) {
        return [];
    }
    return found;
}

async function info() {
    const c = await getClient();
    try {
        const raw = await c.info('server');
        const mem = await c.info('memory');
        const pick = (text, key) => {
            const line = text.split('\n').find((l) => l.startsWith(`#`) === false && l.includes(key));
            return line ? line.split(':')[1].trim() : null;
        };
        return {
            version: pick(raw, 'redis_version'),
            uptime: pick(raw, 'uptime_in_seconds'),
            usedMemory: pick(mem, 'used_memory_human'),
            keys: await c.dbsize()
        };
    } catch (e) {
        return null;
    }
}

/** Kirim event pubsub (mis. force_logout) supaya browser langsung bereaksi */
async function publish(channel, data) {
    try {
        const c = await getClient();
        await c.publish(channel, JSON.stringify(data));
        return true;
    } catch (e) {
        return false;
    }
}

async function close() {
    if (client) {
        try { await client.quit(); } catch (e) { /* ignore */ }
        client = null;
        available = false;
    }
}

module.exports = {
    getClient, ping, isReady, mgetMany, existsMany, del, scanKeys, info, close, get, publish,
    get available() { return available; },
};