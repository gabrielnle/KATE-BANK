import { describe, it, expect, mock } from "bun:test";
import { POST } from "./route";
import { NextRequest } from "next/server";
import * as cpfLib from "@/lib/cpf";

// Mock isValidCPF to return true for specific test CPFs
mock.module("@/lib/cpf", () => ({
  ...cpfLib,
  isValidCPF: (cpf: string) => {
    // 11111111111 is set to 'suspended' in mock db
    // 11144477735 is set to 'regular' in mock db
    // 52998224725 is set to 'regular' in mock db
    // 12345678909 is our dummy one not in db
    if (cpf === "11111111111" || cpf === "11144477735" || cpf === "52998224725" || cpf === "12345678909") {
      return true;
    }
    return false;
  }
}));

describe("POST /api/validate-cpf", () => {
  // We can just stub setTimeout directly to avoid 700ms test latency
  global.setTimeout = ((fn: () => void) => {
    fn();
    return 1 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;

  it("should return 400 if CPF is missing", async () => {
    const req = new NextRequest("http://localhost/api/validate-cpf", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.status).toBe("error");
    expect(data.message).toBe("CPF não informado.");
  });

  it("should return invalid_format if CPF does not have 11 digits", async () => {
    const req = new NextRequest("http://localhost/api/validate-cpf", {
      method: "POST",
      body: JSON.stringify({ cpf: "123" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("invalid_format");
    expect(data.message).toBe("CPF deve ter 11 dígitos.");
  });

  it("should return invalid_digits if CPF fails verification", async () => {
    const req = new NextRequest("http://localhost/api/validate-cpf", {
      method: "POST",
      body: JSON.stringify({ cpf: "11111111112" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("invalid_digits");
    expect(data.message).toBe("CPF inválido. Os dígitos verificadores não conferem.");
  });

  it("should return 500 on internal error", async () => {
    const originalConsoleError = console.error;
    console.error = mock(() => {});

    const req = {
      json: () => Promise.reject(new Error("Invalid JSON")),
    } as unknown as NextRequest;

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.status).toBe("error");
    expect(data.message).toBe("Erro interno ao validar CPF.");

    console.error = originalConsoleError;
  });

  it("should return valid status when serpro simulation succeeds with valid CPF", async () => {
    const req = new NextRequest("http://localhost/api/validate-cpf", {
      method: "POST",
      body: JSON.stringify({ cpf: "11144477735" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("valid");
    expect(data.message).toBe("CPF válido e regular na Receita Federal.");
    expect(data.name).toBe("João da Silva");
  });

  it("should verify birthDate if provided", async () => {
    const req = new NextRequest("http://localhost/api/validate-cpf", {
      method: "POST",
      body: JSON.stringify({ cpf: "11144477735", birthDate: "1990-05-15" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("valid");
    expect(data.birthDateMatch).toBe(true);
  });

  it("should return false for birthDateMatch if birthDate doesn't match", async () => {
    const req = new NextRequest("http://localhost/api/validate-cpf", {
      method: "POST",
      body: JSON.stringify({ cpf: "11144477735", birthDate: "1990-01-01" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("valid");
    expect(data.birthDateMatch).toBe(false);
  });

  it("should return suspended if CPF is suspended", async () => {
    const req = new NextRequest("http://localhost/api/validate-cpf", {
      method: "POST",
      body: JSON.stringify({ cpf: "11111111111" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("suspended");
    expect(data.message).toBe("CPF suspenso na Receita Federal.");
  });

  it("should return valid for a mathematically valid CPF not in the mock DB", async () => {
    const req = new NextRequest("http://localhost/api/validate-cpf", {
      method: "POST",
      body: JSON.stringify({ cpf: "12345678909" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("valid");
    expect(data.message).toBe("CPF válido e regular na Receita Federal.");
    expect(data.birthDateMatch).toBe(undefined);
  });

  it("should verify birthDateMatch as null when valid CPF not in DB and birthDate is provided", async () => {
    const req = new NextRequest("http://localhost/api/validate-cpf", {
      method: "POST",
      body: JSON.stringify({ cpf: "12345678909", birthDate: "1990-01-01" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("valid");
    expect(data.birthDateMatch).toBe(null);
  });

  it("should remove non-digit characters before validating", async () => {
    // 111.444.777-35 is same as 11144477735
    const req = new NextRequest("http://localhost/api/validate-cpf", {
      method: "POST",
      body: JSON.stringify({ cpf: "111.444.777-35" }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("valid");
    expect(data.message).toBe("CPF válido e regular na Receita Federal.");
    expect(data.name).toBe("João da Silva");
  });
});
