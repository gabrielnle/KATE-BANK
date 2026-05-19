import { expect, test, describe } from 'bun:test';
import { formatCPF, isValidCPF } from './cpf';

describe('formatCPF', () => {
  test('should handle empty string', () => {
    expect(formatCPF('')).toBe('');
  });

  test('should not format if length <= 3', () => {
    expect(formatCPF('1')).toBe('1');
    expect(formatCPF('12')).toBe('12');
    expect(formatCPF('123')).toBe('123');
  });

  test('should format with one dot if length is between 4 and 6', () => {
    expect(formatCPF('1234')).toBe('123.4');
    expect(formatCPF('12345')).toBe('123.45');
    expect(formatCPF('123456')).toBe('123.456');
  });

  test('should format with two dots if length is between 7 and 9', () => {
    expect(formatCPF('1234567')).toBe('123.456.7');
    expect(formatCPF('12345678')).toBe('123.456.78');
    expect(formatCPF('123456789')).toBe('123.456.789');
  });

  test('should format with dots and hyphen if length is 10 or 11', () => {
    expect(formatCPF('1234567890')).toBe('123.456.789-0');
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });

  test('should strip non-digit characters', () => {
    expect(formatCPF('123.456.789-01')).toBe('123.456.789-01');
    expect(formatCPF('123a456b789c01')).toBe('123.456.789-01');
  });

  test('should truncate input beyond 11 digits', () => {
    expect(formatCPF('123456789012345')).toBe('123.456.789-01');
  });
});

describe('isValidCPF', () => {
  test('should return true for valid unformatted CPF', () => {
    expect(isValidCPF('52998224725')).toBe(true);
  });

  test('should return true for valid formatted CPF', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
  });

  test('should return false for invalid length', () => {
    expect(isValidCPF('123')).toBe(false);
    expect(isValidCPF('1234567890')).toBe(false);
    expect(isValidCPF('123456789012')).toBe(false);
    expect(isValidCPF('123.456.789-0')).toBe(false);
  });

  test('should return false for known repeated sequences', () => {
    expect(isValidCPF('00000000000')).toBe(false);
    expect(isValidCPF('11111111111')).toBe(false);
    expect(isValidCPF('22222222222')).toBe(false);
    expect(isValidCPF('33333333333')).toBe(false);
    expect(isValidCPF('44444444444')).toBe(false);
    expect(isValidCPF('55555555555')).toBe(false);
    expect(isValidCPF('66666666666')).toBe(false);
    expect(isValidCPF('77777777777')).toBe(false);
    expect(isValidCPF('88888888888')).toBe(false);
    expect(isValidCPF('99999999999')).toBe(false);
    expect(isValidCPF('111.111.111-11')).toBe(false);
  });

  test('should return false for mathematically incorrect check digits', () => {
    expect(isValidCPF('52998224726')).toBe(false);
    expect(isValidCPF('12345678900')).toBe(false);
  });

  test('should return false for non-numeric string missing actual numbers', () => {
    expect(isValidCPF('abcdefghijk')).toBe(false);
  });
});
