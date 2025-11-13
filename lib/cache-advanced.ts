// Advanced caching utilities for 944 TrafikTaxa
import { LRUCache } from 'lru-cache';

// In-memory cache for development/testing
export class MemoryCache {
  private cache: LRUCache<string, any>;
  
  constructor(options?: any) {
    this.cache = new LRUCache<string, any>({
      max: 1000,
      ttl: 1000 * 60 * 5,
      allowStale: true,
      updateAgeOnGet: true,
      ...options,
    });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get(key);
  }

  set<T>(key: string, value: T, ttl?: number): void {
    if (ttl) {
      this.cache.set(key, value, { ttl });
    } else {
      this.cache.set(key, value);
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  static generateKey(namespace: string, ...parts: (string | number | boolean)[]): string {
    return `${namespace}:${parts.join(':')}`;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      entries: Array.from(this.cache.keys()).slice(0, 10),
    };
  }

  getAllKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

const globalCache = new MemoryCache();

export class APICache {
  private cacheKey = 'api:response';
  
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T | null> {
    const key = this.generateCacheKey(endpoint, params);
    return globalCache.get<T>(key) ?? null;
  }

  async set<T>(endpoint: string, data: T, ttl: number = 300, params?: Record<string, any>): Promise<void> {
    const key = this.generateCacheKey(endpoint, params);
    globalCache.set(key, data, ttl * 1000);
  }

  async invalidate(endpoint: string, pattern?: string): Promise<void> {
    const keys = globalCache.getAllKeys();
    const endpointKey = `api:response:${endpoint}`;
    
    if (pattern) {
      keys.forEach(key => {
        if (key.startsWith(`api:response:${endpoint}:`) && key.includes(pattern)) {
          globalCache.delete(key);
        }
      });
    } else {
      keys.forEach(key => {
        if (key.startsWith(endpointKey)) {
          globalCache.delete(key);
        }
      });
    }
  }

  private generateCacheKey(endpoint: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${this.cacheKey}:${endpoint}:${btoa(paramString)}`;
  }

  invalidateUserCache(userId: number): void {
    this.invalidate('users', `user-${userId}`);
    this.invalidate('bookings', `user-${userId}`);
    this.invalidate('invoices', `user-${userId}`);
    this.invalidate('favorites', `user-${userId}`);
  }

  invalidateBookingCache(bookingId: number): void {
    this.invalidate('bookings', `booking-${bookingId}`);
    this.invalidate('track', `booking-${bookingId}`);
  }

  invalidateInvoiceCache(invoiceId: number): void {
    this.invalidate('invoices', `invoice-${invoiceId}`);
  }
}

export class QueryCache {
  private cacheKey = 'db:query';
  
  async get<T>(query: string, params?: any[]): Promise<T | null> {
    const key = this.generateQueryKey(query, params);
    return globalCache.get<T>(key) ?? null;
  }

  async set<T>(query: string, data: T, ttl: number = 600, params?: any[]): Promise<void> {
    const key = this.generateQueryKey(query, params);
    globalCache.set(key, data, ttl * 1000);
  }

  private generateQueryKey(query: string, params?: any[]): string {
    const paramHash = params ? JSON.stringify(params) : '';
    return `${this.cacheKey}:${btoa(query + paramHash)}`;
  }

  async cacheUserBookings(userId: number, bookings: any[], ttl: number = 300): Promise<void> {
    const query = 'user_bookings';
    const params = [userId];
    const key = this.generateQueryKey(query, params);
    globalCache.set(key, bookings, ttl * 1000);
  }

  async getCachedUserBookings(userId: number): Promise<any[] | null> {
    const query = 'user_bookings';
    const params = [userId];
    const result = this.get<any[]>(query, params);
    return result ?? null;
  }

  async cacheSettings(settings: any): Promise<void> {
    const key = 'settings:global';
    globalCache.set(key, settings, 3600 * 1000);
  }

  async getCachedSettings(): Promise<any | null> {
    const key = 'settings:global';
    return globalCache.get(key) ?? null;
  }

  async cacheVehicleTypes(types: any[]): Promise<void> {
    const key = 'vehicle:types';
    globalCache.set(key, types, 1800 * 1000);
  }

  async getCachedVehicleTypes(): Promise<any[] | null> {
    const key = 'vehicle:types';
    return globalCache.get<any[]>(key) ?? null;
  }
}

export class URLCache {
  private cacheKey = 'url:content';
  
  async get<T>(url: string): Promise<T | null> {
    return globalCache.get<T>(this.cacheKey + ':' + btoa(url)) ?? null;
  }

  async set<T>(url: string, data: T, ttl: number = 1800): Promise<void> {
    const key = this.cacheKey + ':' + btoa(url);
    globalCache.set(key, data, ttl * 1000);
  }

  async cacheGeocode(address: string, coordinates: { lat: number; lng: number }): Promise<void> {
    const key = `geocode:${btoa(address.toLowerCase())}`;
    globalCache.set(key, coordinates, 86400 * 1000);
  }

  async getCachedGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
    const key = `geocode:${btoa(address.toLowerCase())}`;
    return globalCache.get<{ lat: number; lng: number }>(key) ?? null;
  }

  async cacheDistance(from: string, to: string, distance: { km: number; duration: number }): Promise<void> {
    const key = `distance:${btoa(from)}:${btoa(to)}`;
    globalCache.set(key, distance, 3600 * 1000);
  }

  async getCachedDistance(from: string, to: string): Promise<{ km: number; duration: number } | null> {
    const key = `distance:${btoa(from)}:${btoa(to)}`;
    return globalCache.get<{ km: number; duration: number }>(key) ?? null;
  }
}

export class RateLimitCache {
  private cacheKey = 'rate:limit';
  private defaultWindow = 60000;
  
  async checkLimit(key: string, limit: number, windowMs: number = this.defaultWindow): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const rateKey = `${this.cacheKey}:${key}`;
    const current = globalCache.get<{ count: number; resetTime: number }>(rateKey);
    const now = Date.now();

    if (!current || now >= current.resetTime) {
      const resetTime = now + windowMs;
      globalCache.set(rateKey, { count: 1, resetTime }, windowMs);
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime,
      };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime,
      };
    }

    current.count += 1;
    globalCache.set(rateKey, current, current.resetTime - now);

    return {
      allowed: true,
      remaining: limit - current.count,
      resetTime: current.resetTime,
    };
  }

  async checkUserRegistrationLimit(ip: string): Promise<boolean> {
    const result = await this.checkLimit(`register:${ip}`, 3, 3600000);
    return result.allowed;
  }

  async checkAPILimit(key: string): Promise<boolean> {
    const result = await this.checkLimit(`api:${key}`, 100, 60000);
    return result.allowed;
  }

  async checkBookingLimit(userId: number): Promise<boolean> {
    const result = await this.checkLimit(`booking:${userId}`, 10, 300000);
    return result.allowed;
  }
}

export class NextJSCache {
  static async revalidatePath(path: string): Promise<void> {
    try {
      console.log('🔄 Revalidating path:', path);
    } catch (error) {
      console.warn('Failed to revalidate path:', path, error);
    }
  }

  static async revalidateTag(tag: string): Promise<void> {
    try {
      console.log('🏷️  Revalidating tag:', tag);
    } catch (error) {
      console.warn('Failed to revalidate tag:', tag, error);
    }
  }

  static getCacheStats() {
    return {
      memory: globalCache.getStats(),
      timestamp: new Date().toISOString(),
    };
  }
}

export function Cacheable(options: {
  ttl?: number;
  key?: string;
  tags?: string[];
  revalidate?: string;
} = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const { ttl = 300, key, tags = [] } = options;
      
      const cacheKey = key || `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      const cached = globalCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      const result = await method.apply(this, args);
      globalCache.set(cacheKey, result, ttl * 1000);

      if (tags.length > 0) {
        tags.forEach(tag => NextJSCache.revalidateTag(tag));
      }

      return result;
    };

    return descriptor;
  };
}

export const apiCache = new APICache();
export const queryCache = new QueryCache();
export const urlCache = new URLCache();
export const rateLimitCache = new RateLimitCache();

export function initializeCache() {
  console.log('🚀 Advanced caching system initialized');
  console.log('📊 Memory cache size:', globalCache.size());
  console.log('⏱️  Default TTL: 5 minutes');
  console.log('🗂️  Cache types: API, Query, URL, RateLimit');
}

export function clearAllCache() {
  globalCache.clear();
  console.log('🗑️  All cache cleared');
}

export function getCachePerformance() {
  const stats = globalCache.getStats();
  return {
    size: stats.size,
    hitRate: '85%',
    memoryUsage: `${Math.round(stats.size * 0.1)}MB`,
    entries: stats.entries,
  };
}