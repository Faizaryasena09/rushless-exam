import Redis from 'ioredis';
import redis from './redis';

const globalForSub = global;
let subscriber = null;
const channels = new Map();

function getSubscriber() {
  if (subscriber) return subscriber;

  const config = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  };

  if (process.env.NODE_ENV === 'production') {
    subscriber = new Redis(config);
  } else {
    if (!globalForSub.redisPubSub) {
      globalForSub.redisPubSub = new Redis(config);
    }
    subscriber = globalForSub.redisPubSub;
  }

  subscriber.on('error', (err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Redis PubSub error (non-fatal):', err.message);
    }
  });

  return subscriber;
}

function onMessage(msgChannel, message) {
  const handlers = channels.get(msgChannel);
  if (!handlers) return;
  try {
    const data = JSON.parse(message);
    for (const handler of handlers) {
      try { handler(data); } catch (e) {
        console.error('PubSub handler error:', e);
      }
    }
  } catch (e) {
    console.error('Redis PubSub parse error:', e);
  }
}

export function subscribe(channel, handler) {
  const sub = getSubscriber();

  if (!sub._pubsubListenerAttached) {
    sub.on('message', onMessage);
    sub._pubsubListenerAttached = true;
  }

  if (!channels.has(channel)) {
    channels.set(channel, new Set());
    sub.subscribe(channel);
  }
  channels.get(channel).add(handler);
}

export function unsubscribe(channel, handler) {
  const handlers = channels.get(channel);
  if (!handlers) return;
  handlers.delete(handler);
  if (handlers.size === 0) {
    channels.delete(channel);
    getSubscriber().unsubscribe(channel);
  }
}

export function publish(channel, data) {
  try {
    redis.publish(channel, JSON.stringify(data));
  } catch (e) {
    // Redis not ready — silent fallback (DB polling handles it)
  }
}
