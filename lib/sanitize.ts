// Unicode-safe sanitizers so Danish letters aren\'t stripped
export function sanitizeAddress(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^\p{L}\p{M}0-9\s,\.\-#&()\/'’]/gu, '').trim();
}

export function sanitizeName(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^\p{L}\p{M}\s\-'.]/gu, '').trim();
}

export function sanitizeInput(input: any, type: 'text'): string | null;
export function sanitizeInput(input: any, type: 'address'): string | null;
export function sanitizeInput(input: any, type: 'number'): number | null;
export function sanitizeInput(input: any, type: 'boolean'): boolean;
export function sanitizeInput(input: any, type: string): string | number | boolean | null;
export function sanitizeInput(input: any, type: string): string | number | boolean | null {
  if (input == null) return null;
  switch (type) {
    case 'text':
      return typeof input === 'string' ? sanitizeName(input) : null;
    case 'address':
      return typeof input === 'string' ? sanitizeAddress(input) : null;
    case 'number':
      if (typeof input === 'number' && !isNaN(input)) return input;
      if (typeof input === 'string') {
        const num = parseFloat(input);
        return isNaN(num) ? null : num;
      }
      return null;
    case 'boolean':
      if (typeof input === 'boolean') return input;
      if (typeof input === 'string') return input.toLowerCase() === 'true' || input === '1';
      if (typeof input === 'number') return input !== 0;
      return false;
    default:
      return null;
  }
}
