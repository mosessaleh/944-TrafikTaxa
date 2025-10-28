import { cn, formatCurrency } from '../../lib/utils';

describe('cn', () => {
  it('should combine class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
    expect(cn('class1', undefined, 'class2')).toBe('class1 class2');
    expect(cn('class1', null, 'class2')).toBe('class1 class2');
    expect(cn('class1', false, 'class2')).toBe('class1 class2');
    expect(cn()).toBe('');
  });

  it('should handle complex class combinations', () => {
    expect(cn('base', true && 'active', false && 'inactive')).toBe('base active');
  });
});

describe('formatCurrency', () => {
  it('should format currency in Danish Krone', () => {
    expect(formatCurrency(100)).toBe('100,00\u00A0kr.');
    expect(formatCurrency(1234.56)).toBe('1.234,56\u00A0kr.');
    expect(formatCurrency(0)).toBe('0,00\u00A0kr.');
  });

  it('should handle negative values', () => {
    expect(formatCurrency(-100)).toBe('-100,00\u00A0kr.');
  });

  it('should handle decimal precision', () => {
    expect(formatCurrency(100.1)).toBe('100,10\u00A0kr.');
    expect(formatCurrency(100.123)).toBe('100,12\u00A0kr.');
  });
});