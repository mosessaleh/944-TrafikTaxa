import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

/**
 * Sanitizes HTML input to prevent XSS attacks
 * @param input - The input string to sanitize
 * @returns Sanitized string safe for HTML output
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: [], // Strip all attributes
  });
}

/**
 * Sanitizes user input for general text fields
 * @param input - The input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';
  return validator.escape(input.trim());
}

/**
 * Sanitizes email input
 * @param input - The email string to sanitize
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(input: string): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().toLowerCase();
  return validator.isEmail(trimmed) ? trimmed : '';
}

/**
 * Sanitizes phone number input (basic validation)
 * @param input - The phone string to sanitize
 * @returns Sanitized phone number
 */
export function sanitizePhone(input: string): string {
  if (typeof input !== 'string') return '';
  // Remove all non-digit characters except + and spaces
  const cleaned = input.replace(/[^\d+\s-()]/g, '').trim();
  return validator.isMobilePhone(cleaned, 'any', { strictMode: false }) ? cleaned : '';
}

/**
 * Sanitizes address input
 * @param input - The address string to sanitize
 * @returns Sanitized address
 */
export function sanitizeAddress(input: string): string {
  if (typeof input !== 'string') return '';
  // Allow letters, numbers, spaces, commas, periods, hyphens
  return input.replace(/[^a-zA-Z0-9\s,.\-]/g, '').trim();
}

/**
 * Sanitizes numeric input
 * @param input - The input to sanitize
 * @returns Sanitized number or null if invalid
 */
export function sanitizeNumber(input: any): number | null {
  const num = Number(input);
  return isNaN(num) ? null : num;
}

/**
 * Sanitizes boolean input
 * @param input - The input to sanitize
 * @returns Boolean value
 */
export function sanitizeBoolean(input: any): boolean {
  return Boolean(input);
}

/**
 * General input sanitizer that applies appropriate sanitization based on type
 * @param input - The input to sanitize
 * @param type - The type of sanitization to apply
 * @returns Sanitized input
 */
export function sanitizeInput(input: any, type: 'text' | 'email' | 'phone' | 'address' | 'number' | 'boolean' | 'html'): any {
  switch (type) {
    case 'text':
      return sanitizeText(input);
    case 'email':
      return sanitizeEmail(input);
    case 'phone':
      return sanitizePhone(input);
    case 'address':
      return sanitizeAddress(input);
    case 'number':
      return sanitizeNumber(input);
    case 'boolean':
      return sanitizeBoolean(input);
    case 'html':
      return sanitizeHtml(input);
    default:
      return sanitizeText(input);
  }
}