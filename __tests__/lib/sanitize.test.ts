import { normalizeInput, sanitizeInput, sanitizeName, sanitizeAddress } from '../../lib/sanitize';

describe('normalizeInput', () => {
  it('should normalize valid strings using NFC', () => {
    const input = 'café'; // Contains composed é
    const result = normalizeInput(input);
    expect(result).toBe('café'); // Should remain the same in NFC
  });

  it('should return empty string for non-string inputs', () => {
    expect(normalizeInput(null as any)).toBe('');
    expect(normalizeInput(undefined as any)).toBe('');
    expect(normalizeInput(123 as any)).toBe('');
    expect(normalizeInput({} as any)).toBe('');
  });

  it('should handle empty strings', () => {
    expect(normalizeInput('')).toBe('');
  });

  it('should fallback to original string if normalize fails', () => {
    // Mock String.prototype.normalize to throw
    const originalNormalize = String.prototype.normalize;
    String.prototype.normalize = jest.fn(() => { throw new Error('Normalize failed'); });

    const input = 'test';
    const result = normalizeInput(input);
    expect(result).toBe('test');

    // Restore original method
    String.prototype.normalize = originalNormalize;
  });
});

describe('sanitizeName', () => {
  it('should allow valid name characters', () => {
    expect(sanitizeName('John Doe')).toBe('John Doe');
    expect(sanitizeName('José María')).toBe('José María');
    expect(sanitizeName("O'Connor")).toBe("O'Connor");
    expect(sanitizeName('Jean-Pierre')).toBe('Jean-Pierre');
  });

  it('should remove unsafe characters', () => {
    expect(sanitizeName('John<script>')).toBe('Johnscript'); // Removes < >
    expect(sanitizeName('John\x00Doe')).toBe('JohnDoe'); // Null byte
    expect(sanitizeName('John\x01Doe')).toBe('JohnDoe'); // Control character
  });

  it('should remove invalid characters for names', () => {
    expect(sanitizeName('John123')).toBe('John');
    expect(sanitizeName('John@Doe')).toBe('JohnDoe');
    expect(sanitizeName('John_Doe')).toBe('JohnDoe'); // Underscore is not allowed
  });

  it('should trim whitespace', () => {
    expect(sanitizeName('  John Doe  ')).toBe('John Doe');
  });

  it('should handle empty input', () => {
    expect(sanitizeName('')).toBe('');
    expect(sanitizeName('   ')).toBe('');
  });
});

describe('sanitizeAddress', () => {
  it('should allow valid address characters', () => {
    expect(sanitizeAddress('123 Main St, City')).toBe('123 Main St, City');
    expect(sanitizeAddress('Avenue des Champs-Élysées')).toBe('Avenue des Champs-Élysées');
  });

  it('should remove unsafe characters', () => {
    expect(sanitizeAddress('123 Main <script>')).toBe('123 Main script'); // Removes < >
    expect(sanitizeAddress('Address\x00')).toBe('Address'); // Null byte
  });

  it('should trim whitespace', () => {
    expect(sanitizeAddress('  123 Main St  ')).toBe('123 Main St');
  });

  it('should handle empty input', () => {
    expect(sanitizeAddress('')).toBe('');
    expect(sanitizeAddress('   ')).toBe('');
  });
});

describe('sanitizeInput', () => {
  describe('text type', () => {
    it('should sanitize as name for text type', () => {
      expect(sanitizeInput('John Doe', 'text')).toBe('John Doe');
      expect(sanitizeInput('John<script>', 'text')).toBe('Johnscript'); // Removes < > but keeps letters
    });
  });

  describe('address type', () => {
    it('should sanitize as address for address type', () => {
      expect(sanitizeInput('123 Main St', 'address')).toBe('123 Main St');
      expect(sanitizeInput('Address<script>', 'address')).toBe('Addressscript'); // Removes < > but keeps letters
    });
  });

  describe('number type', () => {
    it('should parse valid numbers', () => {
      expect(sanitizeInput('123.45', 'number')).toBe('123.45');
      expect(sanitizeInput('-67', 'number')).toBe('-67');
      expect(sanitizeInput('0', 'number')).toBe('0');
    });

    it('should return "0" for invalid numbers', () => {
      expect(sanitizeInput('abc', 'number')).toBe('0');
      expect(sanitizeInput('', 'number')).toBe('0');
      expect(sanitizeInput('not-a-number', 'number')).toBe('0');
    });
  });

  describe('boolean type', () => {
    it('should return "true" for truthy values', () => {
      expect(sanitizeInput('true', 'boolean')).toBe('true');
      expect(sanitizeInput('TRUE', 'boolean')).toBe('true');
      expect(sanitizeInput('1', 'boolean')).toBe('true');
    });

    it('should return "false" for falsy values', () => {
      expect(sanitizeInput('false', 'boolean')).toBe('false');
      expect(sanitizeInput('FALSE', 'boolean')).toBe('false');
      expect(sanitizeInput('0', 'boolean')).toBe('false');
      expect(sanitizeInput('anything', 'boolean')).toBe('false');
      expect(sanitizeInput('', 'boolean')).toBe('false');
    });
  });

  it('should return empty string for invalid type', () => {
    expect(sanitizeInput('test', 'invalid' as any)).toBe('');
  });

  it('should return empty string for non-string input', () => {
    expect(sanitizeInput(null as any, 'text')).toBe('');
    expect(sanitizeInput(123 as any, 'text')).toBe('');
  });
});