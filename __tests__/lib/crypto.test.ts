import {
  normalizeSymbol,
  getCoinGeckoId,
  getNetworks,
  getCoinLogoUrl,
  hashPassword,
  comparePassword,
  SYMBOLS,
  type KnownSymbol
} from '../../lib/crypto';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockBcrypt = require('bcryptjs');

describe('normalizeSymbol', () => {
  it('should normalize valid symbols to lowercase', () => {
    expect(normalizeSymbol('BTC')).toBe('btc');
    expect(normalizeSymbol('UsDt')).toBe('usdt');
    expect(normalizeSymbol('PI')).toBe('pi');
  });

  it('should return undefined for invalid symbols', () => {
    expect(normalizeSymbol('invalid')).toBeUndefined();
    expect(normalizeSymbol('')).toBeUndefined();
    expect(normalizeSymbol('DOGE')).toBeUndefined();
  });

  it('should handle case insensitive matching', () => {
    expect(normalizeSymbol('btc')).toBe('btc');
    expect(normalizeSymbol('BTC')).toBe('btc');
    expect(normalizeSymbol('Btc')).toBe('btc');
  });
});

describe('getCoinGeckoId', () => {
  it('should return correct CoinGecko ID for valid symbols', () => {
    expect(getCoinGeckoId('btc')).toBe('bitcoin');
    expect(getCoinGeckoId('eth')).toBe('ethereum');
    expect(getCoinGeckoId('usdt')).toBe('tether');
    expect(getCoinGeckoId('pi')).toBe('pi-network');
  });

  it('should return undefined for invalid symbols', () => {
    expect(getCoinGeckoId('invalid')).toBeUndefined();
    expect(getCoinGeckoId('')).toBeUndefined();
  });

  it('should handle case insensitive input', () => {
    expect(getCoinGeckoId('BTC')).toBe('bitcoin');
    expect(getCoinGeckoId('Eth')).toBe('ethereum');
  });
});

describe('getNetworks', () => {
  it('should return networks array for valid symbols', () => {
    expect(getNetworks('btc')).toEqual(['Bitcoin']);
    expect(getNetworks('eth')).toEqual(['Ethereum']);
    expect(getNetworks('usdt')).toEqual([
      'TRON (TRC20)',
      'Ethereum (ERC20)',
      'BNB Smart Chain (BEP20)',
      'Polygon (MATIC)',
      'Arbitrum One',
      'Optimism',
      'Avalanche C-Chain',
      'Solana (SPL)'
    ]);
  });

  it('should return empty array for invalid symbols', () => {
    expect(getNetworks('invalid')).toEqual([]);
    expect(getNetworks('')).toEqual([]);
  });

  it('should handle case insensitive input', () => {
    expect(getNetworks('BTC')).toEqual(['Bitcoin']);
    expect(getNetworks('PI')).toEqual(['Pi Network (Mainnet)']);
  });
});

describe('getCoinLogoUrl', () => {
  it('should return correct logo URL for valid symbols', () => {
    expect(getCoinLogoUrl('btc')).toBe('/crypto-logos/btc.png');
    expect(getCoinLogoUrl('eth')).toBe('/crypto-logos/eth.png');
    expect(getCoinLogoUrl('usdt')).toBe('/crypto-logos/usdt.png');
  });

  it('should return undefined for invalid symbols', () => {
    expect(getCoinLogoUrl('invalid')).toBeUndefined();
    expect(getCoinLogoUrl('')).toBeUndefined();
  });

  it('should handle case insensitive input', () => {
    expect(getCoinLogoUrl('BTC')).toBe('/crypto-logos/btc.png');
    expect(getCoinLogoUrl('Pi')).toBe('/crypto-logos/pi.png');
  });
});

describe('SYMBOLS constant', () => {
  it('should contain all expected symbols', () => {
    const expectedSymbols: KnownSymbol[] = ['usdt', 'usdc', 'btc', 'eth', 'bnb', 'xrp', 'pi'];
    const actualSymbols = SYMBOLS.map(s => s.id);

    expect(actualSymbols.sort()).toEqual(expectedSymbols.sort());
  });

  it('should have valid structure for each symbol', () => {
    SYMBOLS.forEach(symbol => {
      expect(symbol).toHaveProperty('id');
      expect(symbol).toHaveProperty('label');
      expect(symbol).toHaveProperty('coingeckoId');
      expect(symbol).toHaveProperty('networks');
      expect(Array.isArray(symbol.networks)).toBe(true);
      expect(symbol.networks.length).toBeGreaterThan(0);
    });
  });

  it('should have unique IDs', () => {
    const ids = SYMBOLS.map(s => s.id);
    const uniqueIds = [...new Set(ids)];
    expect(ids).toEqual(uniqueIds);
  });
});

describe('hashPassword', () => {
  it('should hash password with correct salt rounds', async () => {
    const password = 'testPassword123';
    const hashedPassword = 'hashedPassword';

    mockBcrypt.hash.mockResolvedValue(hashedPassword);

    const result = await hashPassword(password);

    expect(result).toBe(hashedPassword);
    expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
  });

  it('should handle empty password', async () => {
    const password = '';
    const hashedPassword = 'hashedEmpty';

    mockBcrypt.hash.mockResolvedValue(hashedPassword);

    const result = await hashPassword(password);

    expect(result).toBe(hashedPassword);
    expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
  });
});

describe('comparePassword', () => {
  it('should return true for matching password and hash', async () => {
    const password = 'testPassword123';
    const hash = 'hashedPassword';

    mockBcrypt.compare.mockResolvedValue(true);

    const result = await comparePassword(password, hash);

    expect(result).toBe(true);
    expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
  });

  it('should return false for non-matching password and hash', async () => {
    const password = 'wrongPassword';
    const hash = 'hashedPassword';

    mockBcrypt.compare.mockResolvedValue(false);

    const result = await comparePassword(password, hash);

    expect(result).toBe(false);
    expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
  });

  it('should handle empty password', async () => {
    const password = '';
    const hash = 'hashedPassword';

    mockBcrypt.compare.mockResolvedValue(false);

    const result = await comparePassword(password, hash);

    expect(result).toBe(false);
    expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
  });
});