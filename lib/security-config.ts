import { randomBytes } from 'crypto';

const motorApiToken = process.env.MOTORAPI_TOKEN?.trim() || '';
const expoAccessToken = process.env.EXPO_ACCESS_TOKEN?.trim() || '';

function resolveAuthSecret(): string {
  const configuredSecret = (process.env.AUTH_SECRET || process.env.JWT_SECRET || '').trim();
  if (configuredSecret.length >= 32) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET/JWT_SECRET env var is required in production and must be at least 32 characters');
  }

  const ephemeralSecret = randomBytes(48).toString('hex');
  console.warn('⚠️ AUTH_SECRET/JWT_SECRET is missing or too short. Using an ephemeral development secret for this process only.');
  return ephemeralSecret;
}

const authSecret = resolveAuthSecret();

export function requireAuthSecret(context: string): string {
  if (!authSecret || authSecret.length < 32) {
    throw new Error(`Missing or invalid AUTH secret in ${context}`);
  }
  return authSecret;
}

export function requireMotorApiToken(context: string): string {
  if (!motorApiToken) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Missing MOTORAPI_TOKEN environment variable. Required in ${context}.`
      );
    }
    return '';
  }

  return motorApiToken;
}

export function getExpoAccessToken(): string | undefined {
  return expoAccessToken || undefined;
}

export function hasExpoAccessToken(): boolean {
  return Boolean(expoAccessToken);
}
