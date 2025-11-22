import { cacheKeys, cacheHeaders } from '../../lib/cache';

describe('cacheKeys', () => {
  it('should generate quote cache key', () => {
    const key = cacheKeys.quote('pickup', 'dropoff', 2, '2024-01-01');
    expect(key).toBe('quote:pickup:dropoff:2:2024-01-01');
  });

  it('should generate vehicle types cache key', () => {
    const key = cacheKeys.vehicleTypes();
    expect(key).toBe('vehicle_types');
  });

  it('should generate user profile cache key', () => {
    const key = cacheKeys.userProfile('user123');
    expect(key).toBe('user_profile:user123');
  });

  it('should generate bookings cache key', () => {
    const key = cacheKeys.bookings('user123', 2);
    expect(key).toBe('bookings:user123:2');
  });

  it('should generate bookings cache key with default page', () => {
    const key = cacheKeys.bookings('user123');
    expect(key).toBe('bookings:user123:1');
  });

  it('should generate crypto prices cache key', () => {
    const key = cacheKeys.cryptoPrices('btc');
    expect(key).toBe('crypto_price:btc');
  });

  it('should generate exchange rates cache key', () => {
    const key = cacheKeys.exchangeRates();
    expect(key).toBe('exchange_rates');
  });
});

describe('cacheHeaders', () => {
  it('should have short cache headers', () => {
    expect(cacheHeaders.short).toEqual({
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
    });
  });

  it('should have long cache headers', () => {
    expect(cacheHeaders.long).toEqual({
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
  });

  it('should have no cache headers', () => {
    expect(cacheHeaders.noCache).toEqual({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
  });

  it('should generate revalidate headers', () => {
    const headers = cacheHeaders.revalidate(300);
    expect(headers).toEqual({
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200',
    });
  });
});