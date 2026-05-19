import { expect, test, describe } from 'bun:test';
import { POST } from './route';
import { NextRequest } from 'next/server';

describe('POST /api/validate-cpf null cases (simulateSerpro)', () => {
  const createRequest = (body: any) => {
    return new NextRequest('http://localhost/api/validate-cpf', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  test('should return valid status and undefined birthDateMatch when record is not found and birthDate is NOT provided', async () => {
    const req = createRequest({ cpf: '10000000019' }); // Valid mathematical CPF, but not in MOCK_DB
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      status: 'valid',
      message: 'CPF válido e regular na Receita Federal.',
    });
  });

  test('should return valid status and null birthDateMatch when record is not found and birthDate IS provided', async () => {
    const req = createRequest({ cpf: '10000000019', birthDate: '1990-01-01' }); // Valid mathematical CPF, but not in MOCK_DB
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      status: 'valid',
      message: 'CPF válido e regular na Receita Federal.',
      birthDateMatch: null,
    });
  });
});
