import { describe, it, expect } from 'vitest';
import { parseCurrencyInput, formatCurrencyInput, validateCPF, validateCNPJ, isValidCnpjCpf } from '../financeUtils';

describe('financeUtils', ()=>{
  it('parses currency input correctly', ()=>{
    expect(parseCurrencyInput('R$ 1.234,56')).toBeCloseTo(1234.56);
    expect(parseCurrencyInput('123456')).toBeCloseTo(1234.56);
    expect(parseCurrencyInput('0')).toBe(0);
  });

  it('formats currency input', ()=>{
    const s = formatCurrencyInput(1234.56);
    expect(s.includes('R$') || s.includes('R$')).toBeTruthy();
  });

  it('validates CPF correctly', ()=>{
    // sample valid CPF
    expect(validateCPF('52998224725')).toBe(true);
    expect(validateCPF('12345678909')).toBe(false);
  });

  it('validates CNPJ correctly', ()=>{
    expect(validateCNPJ('11444777000161')).toBe(true);
    expect(validateCNPJ('00000000000000')).toBe(false);
  });

  it('isValidCnpjCpf wrapper', ()=>{
    expect(isValidCnpjCpf('52998224725')).toBe(true);
    expect(isValidCnpjCpf('11444777000161')).toBe(true);
    expect(isValidCnpjCpf('123')).toBe(false);
  });
});
