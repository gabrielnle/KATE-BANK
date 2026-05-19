import { expect, test, describe, spyOn } from "bun:test";
import { SimulatedStellarClient, StellarClient } from "./client";
import * as StellarSdk from "@stellar/stellar-sdk";

describe("SimulatedStellarClient", () => {
  test("generateKeypair returns valid keys with cryptographically secure random ID", () => {
    const keypair1 = SimulatedStellarClient.generateKeypair();
    const keypair2 = SimulatedStellarClient.generateKeypair();

    expect(keypair1.publicKey).toMatch(/^G[0-9A-F]{8}SIMULATED0+/);
    expect(keypair1.secretKey).toMatch(/^S[0-9A-F]{8}SIMULATED0+/);

    // IDs should be different (very high probability)
    expect(keypair1.publicKey).not.toBe(keypair2.publicKey);

    // Verify ID length (8 hex chars = 4 bytes)
    const id1 = keypair1.publicKey.substring(1, 9);
    expect(id1).toHaveLength(8);
    expect(id1).toMatch(/^[0-9A-F]+$/);
  });
});

describe("StellarClient", () => {
  describe("testConnection", () => {
    test("handles 404 error by returning connected: true", async () => {
      const keypair = StellarSdk.Keypair.random();
      const client = new StellarClient({
        STELLAR_KATE_SECRET_KEY: keypair.secret(),
        STELLAR_USE_TESTNET: 'true'
      });

      const serverSpy = spyOn((client as unknown as { server: { loadAccount: () => Promise<unknown> } }).server, "loadAccount").mockRejectedValue({
        response: { status: 404 }
      });

      const result = await client.testConnection();
      expect(serverSpy).toHaveBeenCalledWith(keypair.publicKey());
      expect(result).toEqual({
        connected: true,
        network: 'testnet',
        katePublicKey: keypair.publicKey(),
      });
    });

    test("throws other errors", async () => {
      const keypair = StellarSdk.Keypair.random();
      const client = new StellarClient({
        STELLAR_KATE_SECRET_KEY: keypair.secret(),
        STELLAR_USE_TESTNET: 'true'
      });

      const errorMessage = "Network error";
      const serverSpy = spyOn((client as unknown as { server: { loadAccount: () => Promise<unknown> } }).server, "loadAccount").mockRejectedValue(new Error(errorMessage));

      await expect(client.testConnection()).rejects.toThrow(errorMessage);
      expect(serverSpy).toHaveBeenCalledWith(keypair.publicKey());
    });

    test("returns connected: true when no error is thrown", async () => {
      const keypair = StellarSdk.Keypair.random();
      const client = new StellarClient({
        STELLAR_KATE_SECRET_KEY: keypair.secret(),
        STELLAR_USE_TESTNET: 'true'
      });

      const serverSpy = spyOn((client as unknown as { server: { loadAccount: () => Promise<unknown> } }).server, "loadAccount").mockResolvedValue({} as unknown);

      const result = await client.testConnection();
      expect(serverSpy).toHaveBeenCalledWith(keypair.publicKey());
      expect(result).toEqual({
        connected: true,
        network: 'testnet',
        katePublicKey: keypair.publicKey(),
      });
    });
  });
});
