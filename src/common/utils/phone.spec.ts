import { describe, it, expect } from 'vitest';
import { normalizeBdPhone } from './phone.js';

describe('normalizeBdPhone', () => {
  it('should normalize standard 11-digit BD numbers', () => {
    expect(normalizeBdPhone('01712345678')).toBe('01712345678');
    expect(normalizeBdPhone('01987654321')).toBe('01987654321');
  });

  it('should strip spaces and hyphens', () => {
    expect(normalizeBdPhone('01712-345 678')).toBe('01712345678');
    expect(normalizeBdPhone(' 01811 223344 ')).toBe('01811223344');
  });

  it('should remove +88 or 88 country code', () => {
    expect(normalizeBdPhone('+8801712345678')).toBe('01712345678');
    expect(normalizeBdPhone('8801712345678')).toBe('01712345678');
  });

  it('should convert Bangla digits to English', () => {
    expect(normalizeBdPhone('০১৭১২৩৪৫৬৭৮')).toBe('01712345678');
    expect(normalizeBdPhone('+৮৮০১৮১১২২৩৩৪৪')).toBe('01811223344');
  });

  it('should throw an error for invalid lengths or invalid operator prefixes', () => {
    expect(() => normalizeBdPhone('01212345678')).toThrow(); // 012 is invalid operator
    expect(() => normalizeBdPhone('017123456')).toThrow(); // Too short
    expect(() => normalizeBdPhone('0171234567899')).toThrow(); // Too long
    expect(() => normalizeBdPhone('')).toThrow();
  });
});

