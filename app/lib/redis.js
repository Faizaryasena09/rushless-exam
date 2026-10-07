import Redis from 'ioredis';
import { recordInfraError } from './log-fallback';

const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: null,
};

let redis;

const setupListeners = (client) => {
    let lastErrorTime = 0;
    client.on('error', (err) => {
        const now = Date.now();
        if (now - lastErrorTime > 30000) {
            // Redis mati = sistem berjalan tanpa buffer. Semua log masuk ke MySQL
            // secara langsung; jika MySQL juga mati, logger.js memindahkannya ke file.
            recordInfraError('redis-unavailable', err, { note: 'Sistem berjalan tanpa buffer Redis' });
            lastErrorTime = now;
        }
    });

    client.on('close', () => {
        recordInfraError('redis-connection-closed', new Error('Redis connection closed'), { host: redisConfig.host, port: redisConfig.port });
    });

    client.on('connect', () => {
        console.log('Successfully connected to Redis');
    });

    client.on('ready', () => {
        console.log('Redis is ready and accepting commands');
    });
};

if (process.env.NODE_ENV === 'production') {
    redis = new Redis(redisConfig);
    setupListeners(redis);
} else {
    // Prevent multiple instances during hot-reload in development
    if (!global.redis) {
        global.redis = new Redis(redisConfig);
        setupListeners(global.redis);
    }
    redis = global.redis;
}

/**
 * Helper to check if Redis is currently usable
 */
export const isRedisReady = () => {
    return redis.status === 'ready';
};

export default redis;
