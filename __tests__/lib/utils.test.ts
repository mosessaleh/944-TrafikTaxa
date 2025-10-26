import { cn, formatCurrency } from '../../lib/utils';

describe('cn', () => {
  it('should combine class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
    expect(cn('class1', undefined, 'class2')).toBe('class1 class2');
    expect(cn('class1', null, 'class2')).toBe('class1 class2');
    expect(cn('class1', false, 'class2')).toBe('class1 class2');
    expect(cn()).toBe('');
  });
});

describe('formatCurrency', () => {
  it('should format currency in Danish Krone', () => {
    expect(formatCurrency(100)).toBe('100,00\u00A0kr.');
    expect(formatCurrency(1234.56)).toBe('1.234,56\u00A0kr.');
    expect(formatCurrency(0)).toBe('0,00\u00A0kr.');
  });
});