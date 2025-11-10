import { LRUCache } from 'lru-cache';

// In-memory cache for API responses
const apiCache = new LRUCache<string, { data: any; timestamp: number }>({
  max: 500, // Maximum 500 entries
  ttl: 1000 * 60 * 5, // 5 minutes TTL
  allowStale: false,
});

// Cache for expensive operations like geocoding
const geoCache = new LRUCache<string, { result: any; timestamp: number }>({
  max: 1000, // Maximum 1000 entries
  ttl: 1000 * 60 * 60 * 24, // 24 hours TTL
});

// Cache for price calculations
const priceCache = new LRUCache<string, { price: number; timestamp: number }>({
  max: 2000, // Maximum 2000 entries
  ttl: 1000 * 60 * 30, // 30 minutes TTL
});

export class CacheManager {
  // API Response Caching
  static setApiCache(key: string, data: any): void {
    apiCache.set(key, { data, timestamp: Date.now() });
  }

  static getApiCache(key: string): any | null {
    const cached = apiCache.get(key);
    if (cached) {
      // Check if cache is still fresh (within 80% of TTL)
      const age = Date.now() - cached.timestamp;
      const maxAge = 1000 * 60 * 5 * 0.8; // 80% of 5 minutes
      if (age < maxAge) {
        return cached.data;
      }
    }
    return null;
  }

  // Geocoding Cache
  static setGeoCache(address: string, result: any): void {
    const key = `geo:${address.toLowerCase().trim()}`;
    geoCache.set(key, { result, timestamp: Date.now() });
  }

  static getGeoCache(address: string): any | null {
    const key = `geo:${address.toLowerCase().trim()}`;
    const cached = geoCache.get(key);
    return cached ? cached.result : null;
  }

  // Price Calculation Cache
  static setPriceCache(distance: number, duration: number, vehicleTypeId: number, price: number): void {
    const key = `price:${distance.toFixed(2)}:${duration}:${vehicleTypeId}`;
    priceCache.set(key, { price, timestamp: Date.now() });
  }

  static getPriceCache(distance: number, duration: number, vehicleTypeId: number): number | null {
    const key = `price:${distance.toFixed(2)}:${duration}:${vehicleTypeId}`;
    const cached = priceCache.get(key);
    return cached ? cached.price : null;
  }

  // Cache Statistics
  static getStats() {
    return {
      apiCache: {
        size: apiCache.size,
        maxSize: apiCache.max,
      },
      geoCache: {
        size: geoCache.size,
        maxSize: geoCache.max,
      },
      priceCache: {
        size: priceCache.size,
        maxSize: priceCache.max,
      },
    };
  }

  // Clear all caches (useful for testing or manual cache invalidation)
  static clearAll(): void {
    apiCache.clear();
    geoCache.clear();
    priceCache.clear();
  }

  // Clear specific cache types
  static clearApiCache(): void {
    apiCache.clear();
  }

  static clearGeoCache(): void {
    geoCache.clear();
  }

  static clearPriceCache(): void {
    priceCache.clear();
  }
}

// Cache keys generators
export const cacheKeys = {
  quote: (pickup: string, dropoff: string, passengers: number, when: string) =>
    `quote:${pickup}:${dropoff}:${passengers}:${when}`,

  vehicleTypes: () => 'vehicle_types',

  userProfile: (userId: string) => `user_profile:${userId}`,

  bookings: (userId: string, page: number = 1) => `bookings:${userId}:${page}`,

  cryptoPrices: (symbol: string) => `crypto_price:${symbol}`,

  exchangeRates: () => 'exchange_rates',
};

// HTTP Cache Headers
export const cacheHeaders = {
  // Short cache for dynamic content
  short: {
    'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
  },

  // Long cache for static content
  long: {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },

  // No cache for sensitive data
  noCache: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },

  // Revalidation for API responses
  revalidate: (seconds: number) => ({
    'Cache-Control': `public, max-age=${seconds}, s-maxage=${seconds * 2}, stale-while-revalidate=${seconds * 4}`,
  }),
};