import { LRUCache } from 'lru-cache';

interface ApiCacheEntry {
  data: any;
  timestamp: number;
}

interface GeoCacheEntry {
  result: any;
  timestamp: number;
}

interface PriceCacheEntry {
  price: number;
  timestamp: number;
}

interface DistanceCacheEntry {
  distance: number;
  duration: number;
  timestamp: number;
}

// In-memory cache for API responses
const apiCache = new LRUCache({
  max: 500, // Maximum 500 entries
  ttl: 1000 * 60 * 5, // 5 minutes TTL
  allowStale: false,
});

// Cache for expensive operations like geocoding
const geoCache = new LRUCache({
  max: 1000, // Maximum 1000 entries
  ttl: 1000 * 60 * 60 * 24, // 24 hours TTL
});

// Cache for price calculations
const priceCache = new LRUCache({
  max: 2000, // Maximum 2000 entries
  ttl: 1000 * 60 * 30, // 30 minutes TTL
});

// Cache for distance/duration calculations
const distanceCache = new LRUCache({
  max: 5000, // Maximum 5000 entries
  ttl: 1000 * 60 * 15, // 15 minutes TTL
});

class CacheManagerClass {
  // API Response Caching
  static setApiCache(key: string, data: any): void {
    apiCache.set(key, { data, timestamp: Date.now() });
  }

  static getApiCache(key: string): any | null {
    const cached = apiCache.get(key) as ApiCacheEntry | undefined;
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
    const cached = geoCache.get(key) as GeoCacheEntry | undefined;
    return cached ? cached.result : null;
  }

  // Price Calculation Cache
  static setPriceCache(distance: number, duration: number, vehicleTypeId: number, price: number): void {
    const key = `price:${distance.toFixed(2)}:${duration}:${vehicleTypeId}`;
    priceCache.set(key, { price, timestamp: Date.now() });
  }

  static getPriceCache(distance: number, duration: number, vehicleTypeId: number): number | null {
    const key = `price:${distance.toFixed(2)}:${duration}:${vehicleTypeId}`;
    const cached = priceCache.get(key) as PriceCacheEntry | undefined;
    return cached ? cached.price : null;
  }

  // Distance/Duration Cache
  static setDistanceCache(originLat: number, originLng: number, destLat: number, destLng: number, distance: number, duration: number): void {
    const key = `dist:${originLat.toFixed(4)}:${originLng.toFixed(4)}:${destLat.toFixed(4)}:${destLng.toFixed(4)}`;
    distanceCache.set(key, { distance, duration, timestamp: Date.now() });
  }

  static getDistanceCache(originLat: number, originLng: number, destLat: number, destLng: number): { distance: number; duration: number } | null {
    const key = `dist:${originLat.toFixed(4)}:${originLng.toFixed(4)}:${destLat.toFixed(4)}:${destLng.toFixed(4)}`;
    const cached = distanceCache.get(key) as DistanceCacheEntry | undefined;
    return cached ? { distance: cached.distance, duration: cached.duration } : null;
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
      distanceCache: {
        size: distanceCache.size,
        maxSize: distanceCache.max,
      },
    };
  }

  // Clear all caches (useful for testing or manual cache invalidation)
  static clearAll() {
    apiCache.clear();
    geoCache.clear();
    priceCache.clear();
    distanceCache.clear();
  }

  // Clear specific cache types
  static clearApiCache() {
    apiCache.clear();
  }

  static clearGeoCache() {
    geoCache.clear();
  }

  static clearPriceCache() {
    priceCache.clear();
  }

  static clearDistanceCache() {
    distanceCache.clear();
  }
}

// Cache keys generators
const cacheKeys = {
  quote: (pickup: any, dropoff: any, passengers: any, when: any) =>
    `quote:${pickup}:${dropoff}:${passengers}:${when}`,

  vehicleTypes: () => 'vehicle_types',

  userProfile: (userId: any) => `user_profile:${userId}`,

  bookings: (userId: any, page = 1) => `bookings:${userId}:${page}`,

  cryptoPrices: (symbol: any) => `crypto_price:${symbol}`,

  exchangeRates: () => 'exchange_rates',
};

// HTTP Cache Headers
const cacheHeaders = {
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
  revalidate: (seconds: any) => ({
    'Cache-Control': `public, max-age=${seconds}, s-maxage=${seconds * 2}, stale-while-revalidate=${seconds * 4}`,
  }),
};

export const CacheManager = CacheManagerClass;
export { cacheKeys, cacheHeaders };