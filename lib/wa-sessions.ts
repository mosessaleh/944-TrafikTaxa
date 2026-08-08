import crypto from 'crypto';
import { initRedis, getRedis, memoryStore } from '@/lib/redis';

export type ConvStage = 'greeting' | 'registration' | 'verify_email' | 'booking' | 'payment' | 'menu';

export interface BotSession {
  phone: string;
  stage: ConvStage;
  userId: number | null;
  userExists: boolean;
  firstName: string;
  collected: Record<string, string>;
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
  sessionToken: string;
  ts: number;
}

const TTL_SEC = 30 * 60;
const REDIS_KEY_PREFIX = 'wa:sess:';
const REDIS_TOKEN_PREFIX = 'wa:token:';

let redisReady = false;

initRedis().then((client) => {
  if (client) redisReady = true;
}).catch(() => {});

function getSecret(): string {
  return process.env.WHATSAPP_WEBHOOK_SECRET
    || process.env.WHATSAPP_ACCESS_TOKEN
    || (() => { throw new Error('WHATSAPP_WEBHOOK_SECRET or WHATSAPP_ACCESS_TOKEN is required for session token generation'); })();
}

function generateSessionToken(phone: string): string {
  const secret = getSecret();
  const randomPart = crypto.randomBytes(16).toString('hex');
  return crypto.createHmac('sha256', secret)
    .update(`${phone}:${Date.now()}:${randomPart}`)
    .digest('hex');
}

function serialize(s: BotSession): string {
  return JSON.stringify(s);
}

function deserialize(raw: string): BotSession {
  return JSON.parse(raw);
}

function storageKey(phone: string): string {
  return `${REDIS_KEY_PREFIX}${phone}`;
}

function tokenKey(token: string): string {
  return `${REDIS_TOKEN_PREFIX}${token}`;
}

const redis = (): ReturnType<typeof getRedis> => getRedis();

export function createSession(phone: string, overrides?: Partial<BotSession>): BotSession {
  const session: BotSession = {
    phone,
    stage: 'greeting',
    userId: null,
    userExists: false,
    firstName: '',
    collected: {},
    chatHistory: [],
    sessionToken: generateSessionToken(phone),
    ts: Date.now(),
    ...overrides,
  };
  persistSession(session);
  return session;
}

function persistSession(session: BotSession): void {
  const raw = serialize(session);

  if (redisReady && redis()) {
    const r = redis()!;
    r.setex(storageKey(session.phone), TTL_SEC, raw).catch(() => {});
    r.setex(tokenKey(session.sessionToken), TTL_SEC, session.phone).catch(() => {});
  }

  memoryStore.set(session.phone, raw);
}

function removeSession(phone: string, token?: string): void {
  if (redisReady && redis()) {
    const r = redis()!;
    r.del(storageKey(phone)).catch(() => {});
    if (token) r.del(tokenKey(token)).catch(() => {});
  }

  memoryStore.delete(phone);
}

export async function getUserSession(phone: string): Promise<BotSession | undefined> {
  if (redisReady && redis()) {
    try {
      const raw = await redis()!.get(storageKey(phone));
      if (raw) {
        const session = deserialize(raw);
        memoryStore.set(phone, raw);
        return session;
      }
    } catch {}
  }

  const cached = memoryStore.get(phone);
  if (cached) return deserialize(cached);

  return undefined;
}

export async function getUserSessionByToken(token: string): Promise<BotSession | undefined> {
  if (redisReady && redis()) {
    try {
      const phone = await redis()!.get(tokenKey(token));
      if (phone) {
        const raw = await redis()!.get(storageKey(phone));
        if (raw) {
          const session = deserialize(raw);
          memoryStore.set(phone, raw);
          return session;
        }
        redis()!.del(tokenKey(token)).catch(() => {});
      }
    } catch {}
  }

  for (const phone of memoryStore.keys()) {
    const raw = memoryStore.get(phone);
    if (raw) {
      const session = deserialize(raw);
      if (session.sessionToken === token) return session;
    }
  }

  return undefined;
}

export function touchSession(session: BotSession): void {
  session.ts = Date.now();
  persistSession(session);
}

export function resetSession(phone: string): void {
  const raw = memoryStore.get(phone);
  let token: string | undefined;
  if (raw) {
    try { token = JSON.parse(raw).sessionToken; } catch {}
  }

  removeSession(phone, token);
}
