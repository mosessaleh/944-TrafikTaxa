/**
 * Environment Variables Validation
 * Ensures all required environment variables are present and valid
 */

import { z } from 'zod';

// Define the schema for environment variables
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Authentication
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  PUBLIC_BASE_URL: z.string().url('PUBLIC_BASE_URL must be a valid URL'),
  
  // Email Configuration
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.string().regex(/^\d+$/, 'SMTP_PORT must be a number'),
  SMTP_USER: z.string().email('SMTP_USER must be a valid email'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  FROM_EMAIL: z.string().email('FROM_EMAIL must be a valid email'),
  
  // Optional: Resend Integration
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  
  // Optional: Stripe (Payment)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // Optional: PayPal
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_MODE: z.enum(['sandbox', 'live']).optional().default('sandbox'),
  
  // Optional: Cryptocurrency
  NOWNODES_API_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  
  // Optional: Revolut
  REVOLUT_API_URL: z.string().url().optional(),
  REVOLUT_CLIENT_ID: z.string().optional(),
  REVOLUT_CLIENT_SECRET: z.string().optional(),
  
  // Optional: Admin
  ADMIN_EMAIL: z.string().email().optional(),
  CONTACT_EMAIL: z.string().email().optional(),
  ADMIN_ROUTE_SLUG: z.string().optional(),
  
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Type for validated environment variables
export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validate and return environment variables
 * This will throw an error if validation fails
 */
export function getEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid environment variables. Please check your .env file.');
    }
    throw error;
  }
}

/**
 * Check if all required environment variables are set
 * Returns validation result without throwing
 */
export function validateEnv(): { valid: boolean; errors: string[] } {
  try {
    envSchema.parse(process.env);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      return { valid: false, errors };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Get environment variable with fallback
 */
export function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key];
  if (!value && !fallback) {
    throw new Error(`Environment variable ${key} is not set and no fallback provided`);
  }
  return value || fallback!;
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if we're in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if we're in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

// Validate environment on module load (only in development)
if (isDevelopment() && typeof window === 'undefined') {
  const result = validateEnv();
  if (!result.valid) {
    console.warn('⚠️  Some environment variables are missing or invalid:');
    result.errors.forEach((error) => console.warn(`  - ${error}`));
  } else {
    console.log('✅ Environment variables validated successfully');
  }
}
