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

if (process.env.NODE_ENV === 'production') {
    redis = new Redis(redisConfig);
} else {
    // Prevent multiple instances during hot-reload in development
    if (!global.redis) {
        global.redis = new Redis(redisConfig);
    }
    redis = global.redis;
}

let lastErrorTime = 0;
redis.on('error', (err) => {
    const now = Date.now();
    // Only log error once every 30 seconds to avoid terminal spam
    if (now - lastErrorTime > 30000) {
        console.warn('Redis is currently offline - system running in MySQL fallback mode.');
        lastErrorTime = now;
    }
});

redis.on('connect', () => {
    console.log('Successfully connected to Redis');
});

redis.on('ready', () => {
    console.log('Redis is ready and accepting commands');
});

/**
 * Helper to check if Redis is currently usable
 */
export const isRedisReady = () => {
    return redis.status === 'ready';
};

export default redis;
