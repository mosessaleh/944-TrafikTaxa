import crypto from 'crypto';

function b64url(input: string | Buffer): string {
  const base = (input instanceof Buffer ? input : Buffer.from(String(input))).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return base;
}

export function signJWT(payload: Record<string, any>, secret: string, expiresInSec: number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + expiresInSec, ...payload };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(body));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${data}.${sig}`;
}

export function verifyJWT(token: string, secret: string): { valid: boolean; payload?: any; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, error: 'Malformed token' };
    const [encHeader, encPayload, signature] = parts;
    const data = `${encHeader}.${encPayload}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    if (signature !== expected) return { valid: false, error: 'Bad signature' };
    const payloadJson = Buffer.from(encPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && now > payload.exp) return { valid: false, error: 'Expired' };
    return { valid: true, payload };
  } catch (e: any) {
    return { valid: false, error: e?.message || 'Invalid token' };
  }
}
