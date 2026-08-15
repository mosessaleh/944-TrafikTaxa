import { prisma as prismaClient } from '@/lib/db';
import { randomBytes, createHash } from 'crypto';
import { signToken, getAuthSecret } from '@/lib/auth';
import { verify } from 'jsonwebtoken';
import { sendEmail } from '@/lib/email';

const prisma = prismaClient as any;

const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_BYTES = 128;
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export function generateJti(): string {
  return randomBytes(32).toString('hex');
}

export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(driverId: number): { token: string; jti: string } {
  const jti = generateJti();
  const token = signToken({ id: driverId, driverId, type: 'driver', jti }, { expiresIn: ACCESS_TOKEN_EXPIRY });
  return { token, jti };
}

export async function createDriverSession(
  driverId: number,
  deviceId: string | undefined,
  deviceInfo: string | undefined,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  revokeExisting = true,
): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
  if (revokeExisting) {
    await prisma.driverSession.updateMany({
      where: { driverId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  const { token: accessToken, jti } = signAccessToken(driverId);
  const rawRefreshToken = generateRefreshToken();
  const hashedRefresh = hashRefreshToken(rawRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.driverSession.create({
    data: {
      driverId,
      jti,
      refreshToken: hashedRefresh,
      deviceId: deviceId || null,
      deviceInfo: deviceInfo || null,
      ipAddress: ipAddress || null,
      lastIpAddress: ipAddress || null,
      userAgent: userAgent || null,
      isRevoked: false,
      expiresAt,
    },
  });

  return { accessToken, refreshToken: rawRefreshToken, jti };
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  if (!jti) return false;

  const entry = await prisma.tokenBlacklist.findUnique({ where: { jti } });
  return Boolean(entry);
}

export async function blacklistToken(jti: string, expiresAt?: Date): Promise<void> {
  if (!jti) return;

  try {
    const jtiExpiresAt = expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.tokenBlacklist.upsert({
      where: { jti },
      update: { expiresAt: jtiExpiresAt },
      create: { jti, expiresAt: jtiExpiresAt },
    });

    await prisma.driverSession.updateMany({
      where: { jti, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  } catch {
    // Token may have been blacklisted by another concurrent request
  }
}

export async function cleanupExpiredBlacklist(): Promise<void> {
  try {
    await prisma.tokenBlacklist.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {
    // Cleanup failure is non-critical
  }
}

export async function refreshAccessToken(
  rawRefreshToken: string,
  ipAddress?: string,
): Promise<{ accessToken: string; refreshToken: string; jti: string; driverId: number } | null> {
  const hashed = hashRefreshToken(rawRefreshToken);

  const session = await prisma.driverSession.findUnique({
    where: { refreshToken: hashed },
  });

  if (!session) return null;
  if (session.isRevoked) return null;
  if (new Date() > session.expiresAt) return null;

  const driverId = session.driverId;

  const newRefreshToken = generateRefreshToken();
  const newHashedRefresh = hashRefreshToken(newRefreshToken);

  const { token: accessToken, jti: newJti } = signAccessToken(driverId);

  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.driverSession.update({
    where: { id: session.id },
    data: {
      jti: newJti,
      refreshToken: newHashedRefresh,
      lastIpAddress: ipAddress || session.lastIpAddress,
      lastUsedAt: new Date(),
      expiresAt: newExpiresAt,
    },
  });

  const oldJti = session.jti;
  if (oldJti) {
    cleanupExpiredBlacklist().catch(() => {});
  }

  return {
    accessToken,
    refreshToken: newRefreshToken,
    jti: newJti,
    driverId,
  };
}

export async function revokeDriverSessions(driverId: number, exceptJti?: string): Promise<void> {
  await prisma.driverSession.updateMany({
    where: {
      driverId,
      isRevoked: false,
      ...(exceptJti ? { jti: { not: exceptJti } } : {}),
    },
    data: { isRevoked: true, revokedAt: new Date() },
  });
}

export async function trackIpChange(
  jti: string,
  currentIp: string,
): Promise<{ changed: boolean; previousIp: string | null }> {
  if (!jti || !currentIp) return { changed: false, previousIp: null };

  try {
    const session = await prisma.driverSession.findUnique({
      where: { jti },
      select: { lastIpAddress: true },
    });

    if (!session) return { changed: false, previousIp: null };

    const previousIp = session.lastIpAddress || null;
    const changed = previousIp !== null && previousIp !== currentIp;

    if (changed) {
      await prisma.driverSession.update({
        where: { jti },
        data: { lastIpAddress: currentIp },
      });
    }

    return { changed, previousIp };
  } catch {
    return { changed: false, previousIp: null };
  }
}

export async function sendLoginNotificationEmail(
  driverId: number,
  driverName: string,
  driverEmail: string,
  deviceInfo: string | undefined,
  ipAddress: string | undefined,
): Promise<void> {
  if (!driverEmail) return;

  const now = new Date().toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' });
  const deviceStr = deviceInfo || 'Unknown device';
  const ipStr = ipAddress || 'Unknown IP';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Login to Your Driver Account</h2>
      <p>Hello ${driverName},</p>
      <p>A new login was detected on your driver account.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Date & Time:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${now}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Device:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${deviceStr}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>IP Address:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${ipStr}</td></tr>
      </table>
      <p style="color: #666;">If this was not you, please contact support immediately.</p>
      <p style="color: #999; font-size: 12px;">This is an automated security notification from 944 Trafik.</p>
    </div>
  `;

  sendEmail(driverEmail, 'New Login - 944 Trafik Driver App', html).catch((err) => {
    console.warn('Failed to send login notification email:', err);
  });
}

export function extractJtiFromToken(token: string): string | null {
  try {
    const decoded = verify(token, getAuthSecret(), { algorithms: ['HS256'] }) as { jti?: string };
    return decoded.jti || null;
  } catch {
    return null;
  }
}

export function getClientIp(request: Request | { headers: Headers }): string {
  const h = (request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'local').split(',')[0].trim();
  return h || 'local';
}
