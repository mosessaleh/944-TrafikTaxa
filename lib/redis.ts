import { Redis } from 'ioredis';
import { LRUCache } from 'lru-cache';

let redisClient: Redis | null = null;

function getRedisUrl(): string | undefined {
  return process.env.REDIS_URL || undefined;
}

export function isRedisAvailable(): boolean {
  return !!getRedisUrl();
}

export async function initRedis(): Promise<Redis | null> {
  if (redisClient) return redisClient;

  const url = getRedisUrl();
  if (!url) {
    console.log('[Redis] REDIS_URL not configured — using in-memory fallback');
    return null;
  }

  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 3) {
          console.error('[Redis] Max retries exceeded, falling back to in-memory');
          redisClient?.disconnect();
          redisClient = null;
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    await redisClient.connect();
    console.log('[Redis] Client initialized');
    return redisClient;
  } catch (err) {
    console.error('[Redis] Failed to initialize:', err);
    redisClient?.disconnect();
    redisClient = null;
    return null;
  }
}

export function getRedis(): Redis | null {
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

const MAX_SESSIONS = 10000;
const SESSION_TTL_MS = 30 * 60 * 1000;

export const memoryStore = new LRUCache<string, string>({
  max: MAX_SESSIONS,
  ttl: SESSION_TTL_MS,
  updateAgeOnGet: true,
  updateAgeOnHas: false,
});
