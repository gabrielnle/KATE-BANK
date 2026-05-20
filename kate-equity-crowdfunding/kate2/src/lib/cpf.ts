/**
 * Utilitários de validação de CPF
 * Implementa o algoritmo oficial de verificação dos dígitos verificadores
 */

/**
 * Remove formatação e valida matematicamente um CPF
 */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');

  // Deve ter exatamente 11 dígitos
  if (digits.length !== 11) return false;

  // Rejeita sequências inválidas conhecidas (ex: 000.000.000-00, 111.111.111-11...)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;

  return true;
}

/**
 * Aplica máscara de formatação: 000.000.000-00
 */
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Status da validação do CPF retornado pela API
 */
export type CPFValidationStatus =
  | 'idle'
  | 'checking'
  | 'valid'
  | 'invalid_format'
  | 'invalid_digits'
  | 'not_found'
  | 'suspended'
  | 'cancelled'
  | 'already_registered'
  | 'error';

export interface CPFValidationResult {
  status: CPFValidationStatus;
  message: string;
  name?: string;           // Nome retornado pela Receita (quando disponível)
  birthDateMatch?: boolean; // Se a data de nascimento bate com o cadastro
}
