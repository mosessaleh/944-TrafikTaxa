import { LRUCache } from 'lru-cache';

// Very simple in-memory rate limiter (per-process). For production, back with Redis.
// Usage: await limitOrThrow(key, { points:5, durationSec:60 })

type Opts = { points: number; durationSec: number };

const buckets = new LRUCache<string, { count: number; resetAt: number }>({ max: 5000 });

export async function limitOrThrow(key: string, opts: Opts){
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt){
    buckets.set(key, { count: 1, resetAt: now + opts.durationSec * 1000 });
    return;
  }
  if (cur.count >= opts.points){
    const retryAfter = Math.max(1, Math.ceil((cur.resetAt - now)/1000));
    const err: any = new Error('Too many requests');
    err.status = 429; err.retryAfter = retryAfter;
    throw err;
  }
  cur.count += 1; buckets.set(key, cur);
}

export function clientIpKey(req: Request){
  const h = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'local').split(',')[0].trim();
  return h || 'local';
}
