import crypto from 'crypto';

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

const TTL = 30 * 60 * 1000;
const sessions = new Map<string, BotSession>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) if (now - v.ts > TTL) sessions.delete(k);
}, 5 * 60 * 1000);

function generateSessionToken(phone: string): string {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET || process.env.WHATSAPP_ACCESS_TOKEN || '944trafik-fallback';
  const randomPart = crypto.randomBytes(12).toString('hex');
  return crypto.createHmac('sha256', secret)
    .update(`${phone}:${Date.now()}:${randomPart}`)
    .digest('hex');
}

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
  sessions.set(phone, session);
  return session;
}

export function getUserSession(phone: string): BotSession | undefined {
  return sessions.get(phone);
}

export function getUserSessionByToken(token: string): BotSession | undefined {
  for (const s of sessions.values()) {
    if (s.sessionToken === token) return s;
  }
  return undefined;
}

export function touchSession(session: BotSession): void {
  session.ts = Date.now();
  sessions.set(session.phone, session);
}

export function resetSession(phone: string): void {
  sessions.delete(phone);
}
