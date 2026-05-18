import { expect, test, describe } from "bun:test";
import { SimulatedStellarClient, getStellarConfigDebug, type StellarEnv } from "./client";

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

describe("getStellarConfigDebug", () => {
  test("handles missing STELLAR_USE_TESTNET by defaulting to true", () => {
    const env: StellarEnv = {
      STELLAR_KATE_SECRET_KEY: "secret",
      STELLAR_KATE_PUBLIC_KEY: "public",
      STELLAR_SIMULATION_MODE: "false"
    };

    const config = getStellarConfigDebug(env);
    expect(config.isTestnet).toBe(true);
  });

  test("handles STELLAR_USE_TESTNET=false correctly", () => {
    const env: StellarEnv = {
      STELLAR_KATE_SECRET_KEY: "secret",
      STELLAR_KATE_PUBLIC_KEY: "public",
      STELLAR_USE_TESTNET: "false",
      STELLAR_SIMULATION_MODE: "false"
    };

    const config = getStellarConfigDebug(env);
    expect(config.isTestnet).toBe(false);
  });

  test("handles STELLAR_USE_TESTNET=true correctly", () => {
    const env: StellarEnv = {
      STELLAR_KATE_SECRET_KEY: "secret",
      STELLAR_KATE_PUBLIC_KEY: "public",
      STELLAR_USE_TESTNET: "true",
      STELLAR_SIMULATION_MODE: "false"
    };

    const config = getStellarConfigDebug(env);
    expect(config.isTestnet).toBe(true);
  });
});
