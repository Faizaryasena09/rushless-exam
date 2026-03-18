import Redis from 'ioredis';

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
            console.warn('Redis is currently offline - system running in MySQL fallback mode.');
            lastErrorTime = now;
        }
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
