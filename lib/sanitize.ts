export function normalizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  try { return input.normalize('NFC'); } catch { return input; }
}
function stripUnsafeCore(s: string): string { return s.replace(/[\p{Cc}\p{Cs}<>]/gu, ''); }
export function sanitizeName(input: string): string { const s = normalizeInput(input); return stripUnsafeCore(s).replace(/[^\p{L}\p{M}\s\-'.]/gu, '').trim(); }
export function sanitizeInput(input: string, type: 'text' | 'address' | 'number' | 'boolean'): string {
  if (typeof input !== 'string') return '';
  const normalized = normalizeInput(input);
  switch (type) {
    case 'text': return sanitizeName(normalized);
    case 'address': return sanitizeAddress(normalized);
    case 'number': {
      const num = parseFloat(normalized);
      return isNaN(num) ? '0' : num.toString();
    }
    case 'boolean': return (normalized.toLowerCase() === 'true' || normalized === '1') ? 'true' : 'false';
    default: return '';
  }
}
export function sanitizeAddress(input: string): string { const s = normalizeInput(input); return stripUnsafeCore(s).trim(); }
