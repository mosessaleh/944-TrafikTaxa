export type KnownSymbol = "usdt" | "usdc" | "btc" | "pi" | "eth" | "bnb" | "xrp";

// Networks are descriptive labels shown to admins when adding wallets.
// Add/remove as needed to match your operational support.
export const SYMBOLS: { id: KnownSymbol; label: string; coingeckoId: string; networks: string[] }[] = [
  // Stablecoins
  { id: "usdt", label: "USDT", coingeckoId: "tether", networks: [
    "TRON (TRC20)",
    "Ethereum (ERC20)",
    "BNB Smart Chain (BEP20)",
    "Polygon (MATIC)",
    "Arbitrum One",
    "Optimism",
    "Avalanche C-Chain",
    "Solana (SPL)"
  ]},
  { id: "usdc", label: "USDC", coingeckoId: "usd-coin", networks: [
    "Ethereum (ERC20)",
    "BNB Smart Chain (BEP20)",
    "Polygon (MATIC)",
    "Arbitrum One",
    "Optimism",
    "Avalanche C-Chain",
    "Solana (SPL)"
  ]},
  // Majors
  { id: "btc",  label: "BTC",  coingeckoId: "bitcoin", networks: ["Bitcoin"] },
  { id: "eth",  label: "ETH",  coingeckoId: "ethereum", networks: ["Ethereum"] },
  { id: "bnb",  label: "BNB",  coingeckoId: "binancecoin", networks: ["BNB Smart Chain (BEP20)", "BNB Beacon Chain (BEP2)"] },
  { id: "xrp",  label: "XRP",  coingeckoId: "ripple", networks: ["XRP Ledger"] },
  // Pi
  { id: "pi",   label: "PI",   coingeckoId: "pi-network", networks: ["Pi Network (Mainnet)"] },
];

export function normalizeSymbol(s: string) {
  const v = s.toLowerCase();
  const hit = SYMBOLS.find(x => x.id === v);
  return hit?.id as KnownSymbol | undefined;
}

export function getCoinGeckoId(symbol: string): string | undefined {
  const id = normalizeSymbol(symbol);
  return SYMBOLS.find(x => x.id === id)?.coingeckoId;
}

export function getNetworks(symbol: string): string[] {
  const id = normalizeSymbol(symbol);
  return SYMBOLS.find(x => x.id === id)?.networks || [];
}

export function getCoinLogoUrl(symbol: string): string | undefined {
  const id = normalizeSymbol(symbol);
  if (!id) return undefined;
  return `/crypto-logos/${id}.png`;
}

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// CPR Encryption/Decryption using AES-256-GCM
const CPR_ENCRYPTION_KEY = process.env.CPR_ENCRYPTION_KEY;
const PAYMENT_TOKEN_ENCRYPTION_KEY =
  process.env.PAYMENT_TOKEN_ENCRYPTION_KEY ||
  process.env.AUTH_SECRET ||
  process.env.JWT_SECRET ||
  process.env.CPR_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const PAYMENT_TOKEN_PREFIX = 'enc:v1:';

// Only throw error if CPR functions are actually called and key is missing
function requireCPREncryptionKey() {
  if (!CPR_ENCRYPTION_KEY) {
    throw new Error('CPR_ENCRYPTION_KEY environment variable is required');
  }
}

function requirePaymentTokenEncryptionKey() {
  if (!PAYMENT_TOKEN_ENCRYPTION_KEY) {
    throw new Error(
      'PAYMENT_TOKEN_ENCRYPTION_KEY or AUTH_SECRET/JWT_SECRET environment variable is required'
    );
  }
}

// Derive key from environment variable
const getEncryptionKey = (): Buffer => {
  requireCPREncryptionKey();
  return crypto.scryptSync(CPR_ENCRYPTION_KEY!, 'salt', KEY_LENGTH);
};

const getPaymentTokenEncryptionKey = (): Buffer => {
  requirePaymentTokenEncryptionKey();
  return crypto.scryptSync(PAYMENT_TOKEN_ENCRYPTION_KEY!, 'payment-token-salt', KEY_LENGTH);
};

export function encryptCPR(plainCPR: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainCPR, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decryptCPR(encryptedCPR: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedCPR.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted CPR format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('CPR decryption failed:', error);
    throw new Error('Failed to decrypt CPR data');
  }
}

function encryptWithKey(value: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptWithKey(value: string, key: Buffer): string {
  const parts = value.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function encryptPaymentToken(token: string): string {
  const encrypted = encryptWithKey(token, getPaymentTokenEncryptionKey());
  return `${PAYMENT_TOKEN_PREFIX}${encrypted}`;
}

export function decryptPaymentToken(token: string): string {
  if (!token.startsWith(PAYMENT_TOKEN_PREFIX)) {
    return token;
  }

  try {
    return decryptWithKey(token.slice(PAYMENT_TOKEN_PREFIX.length), getPaymentTokenEncryptionKey());
  } catch (error) {
    console.error('Payment token decryption failed:', error);
    throw new Error('Failed to decrypt payment token');
  }
}

// Data masking for CPR display
export function maskCPR(cpr: string, showLastDigits: number = 4): string {
  if (cpr.length <= showLastDigits) return cpr;
  return 'X'.repeat(cpr.length - showLastDigits) + cpr.slice(-showLastDigits);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
