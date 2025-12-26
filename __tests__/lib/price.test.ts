import { computeBase, computePrice, computePriceWithDetails, getSettingsForAdmin } from '../../lib/price';

// Mock dependencies
jest.mock('../../lib/db', () => ({
  prisma: {
    settings: {
      findUnique: jest.fn(),
    },
    vehicleType: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../lib/cache', () => ({
  CacheManager: {
    getPriceCache: jest.fn(),
    setPriceCache: jest.fn(),
  },
}));

const mockPrisma = require('../../lib/db').prisma;
const mockCacheManager = require('../../lib/cache').CacheManager;

describe('computeBase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    delete process.env.HOLIDAYS;
  });

  it('should calculate base price for daytime on weekday', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue({
      dayBase: 40,
      dayPerKm: 12.75,
      dayPerMin: 5.75,
      nightBase: 60,
      nightPerKm: 16,
      nightPerMin: 7,
    });

    const date = new Date('2024-01-15T12:00:00'); // Monday noon
    const result = await computeBase(10, 20, date);

    expect(result).toBe(Math.round(40 + 12.75 * 10 + 5.75 * 20)); // 40 + 127.5 + 115 = 282.5 -> 283
  });

  it('should calculate base price for nighttime', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue({
      dayBase: 40,
      dayPerKm: 12.75,
      dayPerMin: 5.75,
      nightBase: 60,
      nightPerKm: 16,
      nightPerMin: 7,
    });

    const date = new Date('2024-01-15T20:00:00'); // 8 PM
    const result = await computeBase(10, 20, date);

    expect(result).toBe(Math.round(60 + 16 * 10 + 7 * 20)); // 60 + 160 + 140 = 360
  });

  it('should calculate base price for holiday', async () => {
    process.env.HOLIDAYS = '2024-01-15';
    mockPrisma.settings.findUnique.mockResolvedValue({
      dayBase: 40,
      dayPerKm: 12.75,
      dayPerMin: 5.75,
      nightBase: 60,
      nightPerKm: 16,
      nightPerMin: 7,
    });

    const date = new Date('2024-01-15T12:00:00'); // Holiday at noon
    const result = await computeBase(10, 20, date);

    expect(result).toBe(Math.round(60 + 16 * 10 + 7 * 20)); // Night rates for holiday
  });

  it('should calculate base price for weekend (Saturday)', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue({
      dayBase: 40,
      dayPerKm: 12.75,
      dayPerMin: 5.75,
      nightBase: 60,
      nightPerKm: 16,
      nightPerMin: 7,
    });

    const date = new Date('2024-01-13T12:00:00'); // Saturday noon
    const result = await computeBase(10, 20, date);

    expect(result).toBe(Math.round(60 + 16 * 10 + 7 * 20)); // Night rates for weekend
  });

  it('should calculate base price for weekend (Sunday)', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue({
      dayBase: 40,
      dayPerKm: 12.75,
      dayPerMin: 5.75,
      nightBase: 60,
      nightPerKm: 16,
      nightPerMin: 7,
    });

    const date = new Date('2024-01-14T12:00:00'); // Sunday noon
    const result = await computeBase(10, 20, date);

    expect(result).toBe(Math.round(60 + 16 * 10 + 7 * 20)); // Night rates for weekend
  });

  it('should use default values when settings not found', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(null);

    const date = new Date('2024-01-15T12:00:00');
    const result = await computeBase(10, 20, date);

    expect(result).toBe(Math.round(40 + 12.75 * 10 + 5.75 * 20)); // Default day rates
  });

  it('should handle zero distance and duration', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(null);

    const date = new Date('2024-01-15T12:00:00');
    const result = await computeBase(0, 0, date);

    expect(result).toBe(40); // Just base price
  });
});

describe('computePrice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return base price when no vehicle type specified', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue({
      dayBase: 40,
      dayPerKm: 12.75,
      dayPerMin: 5.75,
    });

    const date = new Date('2024-01-15T12:00:00');
    const result = await computePrice(10, 20, date);

    expect(result).toBe(Math.round(40 + 12.75 * 10 + 5.75 * 20));
  });

  it('should return cached price when available', async () => {
    mockCacheManager.getPriceCache.mockReturnValue(300);

    const date = new Date('2024-01-15T12:00:00');
    const result = await computePrice(10, 20, date, 1);

    expect(result).toBe(300);
    expect(mockCacheManager.getPriceCache).toHaveBeenCalledWith(10, 20, 1);
  });

  it('should calculate price with vehicle multiplier', async () => {
    mockCacheManager.getPriceCache.mockReturnValue(null);
    mockPrisma.settings.findUnique
      .mockResolvedValueOnce({
        dayBase: 40,
        dayPerKm: 12.75,
        dayPerMin: 5.75,
      })
      .mockResolvedValueOnce(null); // No discount

    mockPrisma.vehicleType.findUnique.mockResolvedValue({
      active: true,
      multiplier: 1.2,
    });

    const date = new Date('2024-01-15T12:00:00');
    const result = await computePrice(10, 20, date, 1);

    const basePrice = Math.round(40 + 12.75 * 10 + 5.75 * 20); // 283
    const expected = Math.round(283 * 1.2); // 340

    expect(result).toBe(expected);
    expect(mockCacheManager.setPriceCache).toHaveBeenCalledWith(10, 20, 1, expected);
  });

  it('should apply global discount', async () => {
    mockCacheManager.getPriceCache.mockReturnValue(null);
    mockPrisma.settings.findUnique
      .mockResolvedValueOnce({
        dayBase: 40,
        dayPerKm: 12.75,
        dayPerMin: 5.75,
      })
      .mockResolvedValueOnce({
        discountPercentage: 10,
        maxDiscountAmount: 50,
      });

    mockPrisma.vehicleType.findUnique.mockResolvedValue({
      active: true,
      multiplier: 1.0,
    });

    const date = new Date('2024-01-15T12:00:00');
    const result = await computePrice(10, 20, date, 1);

    const basePrice = Math.round(40 + 12.75 * 10 + 5.75 * 20); // 283
    const discount = Math.min(283 * 0.1, 50); // 28.3, capped at 50 -> 28.3
    const expected = Math.round(283 - 28.3); // 254.7 -> 255

    expect(result).toBe(expected);
  });

  it('should throw error for inactive vehicle type', async () => {
    mockCacheManager.getPriceCache.mockReturnValue(null);
    mockPrisma.vehicleType.findUnique.mockResolvedValue({
      active: false,
      multiplier: 1.0,
    });

    const date = new Date('2024-01-15T12:00:00');
    await expect(computePrice(10, 20, date, 1)).rejects.toThrow('Vehicle type not available');
  });
});

describe('computePriceWithDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return base price details when no vehicle type', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue({
      dayBase: 40,
      dayPerKm: 12.75,
      dayPerMin: 5.75,
    });

    const date = new Date('2024-01-15T12:00:00');
    const result = await computePriceWithDetails(10, 20, date);

    const basePrice = Math.round(40 + 12.75 * 10 + 5.75 * 20);
    expect(result).toEqual({
      originalPrice: basePrice,
      finalPrice: basePrice,
      discountAmount: 0,
    });
  });

  it('should return detailed pricing with discount', async () => {
    mockPrisma.settings.findUnique
      .mockResolvedValueOnce({
        dayBase: 40,
        dayPerKm: 12.75,
        dayPerMin: 5.75,
      })
      .mockResolvedValueOnce({
        discountPercentage: 15,
        maxDiscountAmount: 100,
      });

    mockPrisma.vehicleType.findUnique.mockResolvedValue({
      active: true,
      multiplier: 1.1,
    });

    const date = new Date('2024-01-15T12:00:00');
    const result = await computePriceWithDetails(10, 20, date, 1);

    const basePrice = Math.round(40 + 12.75 * 10 + 5.75 * 20); // 283
    const priceAfterMultiplier = Math.round(283 * 1.1); // 311
    const discountAmount = Math.min(311 * 0.15, 100); // 46.65, capped at 100
    const finalPrice = Math.round(priceAfterMultiplier - discountAmount); // 311 - 46.65 = 264.35 -> 264

    expect(result).toEqual({
      originalPrice: priceAfterMultiplier,
      finalPrice,
      discountAmount, // 46.65 (not rounded)
    });
  });
});

describe('getSettingsForAdmin', () => {
  it('should return settings from database', async () => {
    const mockSettings = { id: 1, dayBase: 40 };
    mockPrisma.settings.findUnique.mockResolvedValue(mockSettings);

    const result = await getSettingsForAdmin();

    expect(result).toEqual(mockSettings);
    expect(mockPrisma.settings.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});