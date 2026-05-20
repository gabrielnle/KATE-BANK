import { NextRequest, NextResponse } from 'next/server';
import { isValidCPF } from '@/lib/cpf';
import prisma from '@/lib/prisma';

/**
 * API Route: POST /api/validate-cpf
 *
 * Body: { cpf: string, birthDate?: string (YYYY-MM-DD) }
 *
 * Atualmente usa um mock local que simula a resposta do Serpro Consulta CPF.
 * Para produção, substitua o bloco `// SERPRO INTEGRATION` pelas chamadas reais:
 *   - Endpoint: https://gateway.apiserpro.serpro.gov.br/consulta-cpf-trial/v1/cpf/{cpf}
 *   - Auth: Bearer token OAuth 2.0 via client_credentials
 *   - Docs: https://dev.serpro.gov.br/
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cpf, birthDate } = body as { cpf: string; birthDate?: string };

    if (!cpf) {
      return NextResponse.json({ status: 'error', message: 'CPF não informado.' }, { status: 400 });
    }

    const digits = cpf.replace(/\D/g, '');

    // Validação matemática local (dígitos verificadores) — sempre roda
    if (digits.length !== 11) {
      return NextResponse.json({
        status: 'invalid_format',
        message: 'CPF deve ter 11 dígitos.',
      });
    }

    if (!isValidCPF(digits)) {
      return NextResponse.json({
        status: 'invalid_digits',
        message: 'CPF inválido. Os dígitos verificadores não conferem.',
      });
    }

    // Verifica se o CPF já está cadastrado no banco de dados
    const existingUser = await prisma.user.findUnique({
      where: { cpf: digits },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json({
        status: 'already_registered',
        message: 'Este CPF já possui uma conta cadastrada. Faça login ou utilize a recuperação de senha.',
      });
    }

    // =========================================================
    // SERPRO INTEGRATION — substitua este bloco em produção
    // =========================================================
    const serpro = await simulateSerpro(digits, birthDate);
    // =========================================================

    return NextResponse.json(serpro);
  } catch (err) {
    console.error('[validate-cpf] Erro:', err);
    return NextResponse.json(
      { status: 'error', message: 'Erro interno ao validar CPF.' },
      { status: 500 }
    );
  }
}

/**
 * Simulação local do Serpro Consulta CPF.
 * Em produção, substitua por:
 *
 * const token = await getSerprobearerToken(); // OAuth2 client_credentials
 * const res = await fetch(
 *   `https://gateway.apiserpro.serpro.gov.br/consulta-cpf/v1/cpf/${digits}`,
 *   { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
 * );
 * const data = await res.json();
 * // Mapear campos: data.ni, data.nome, data.situacao.codigo, data.nascimento
 */
async function simulateSerpro(cpf: string, birthDate?: string) {
  // Simula latência de rede
  await new Promise(r => setTimeout(r, 700));

  // CPFs de teste local para demonstração
  const MOCK_DB: Record<string, { name: string; birthDate: string; situation: string }> = {
    // CPFs matematicamente válidos para teste
    '11144477735': { name: 'João da Silva', birthDate: '1990-05-15', situation: 'regular' },
    '52998224725': { name: 'Maria Oliveira', birthDate: '1985-11-20', situation: 'regular' },
    '11111111111': { name: '', birthDate: '', situation: 'suspended' },
  };

  const record = MOCK_DB[cpf];

  if (!record) {
    // CPF válido matematicamente mas não encontrado na base — situação real comum
    // Para fins de teste, aceitamos todos os CPFs matematicamente válidos
    return {
      status: 'valid',
      message: 'CPF válido e regular na Receita Federal.',
      birthDateMatch: birthDate ? null : undefined, // null = não verificado
    };
  }

  if (record.situation === 'suspended') {
    return { status: 'suspended', message: 'CPF suspenso na Receita Federal.' };
  }

  if (record.situation === 'cancelled') {
    return { status: 'cancelled', message: 'CPF cancelado na Receita Federal.' };
  }

  // Verificação da data de nascimento
  let birthDateMatch: boolean | null = null;
  if (birthDate && record.birthDate) {
    birthDateMatch = birthDate === record.birthDate;
  }

  return {
    status: 'valid',
    message: 'CPF válido e regular na Receita Federal.',
    name: record.name,
    birthDateMatch,
  };
}
