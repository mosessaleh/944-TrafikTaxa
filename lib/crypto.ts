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

import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
