import { expect, test, describe, spyOn, afterEach, mock } from "bun:test";
import * as StellarSdk from "@stellar/stellar-sdk";
import { StellarClient, SimulatedStellarClient } from "./client";

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
  afterEach(() => {
    mock.restore();
  });

  test("createProjectAsset successfully creates asset transaction", async () => {
    const env = { STELLAR_KATE_SECRET_KEY: StellarSdk.Keypair.random().secret() };
    const client = new StellarClient(env);
    const publicKey = client.getKatePublicKey();

    const mockAccount = new StellarSdk.Account(publicKey, "123456");

    const loadAccountSpy = spyOn(StellarSdk.Horizon.Server.prototype, "loadAccount")
      .mockResolvedValue(mockAccount as any);

    const submitTransactionSpy = spyOn(StellarSdk.Horizon.Server.prototype, "submitTransaction")
      .mockResolvedValue({
        hash: "mock_tx_hash",
        successful: true
      } as any);

    const res = await client.createProjectAsset("TESTCODE", 1000, {
      projectId: "proj-123",
      projectName: "Test Project",
      nftUid: "nft-456"
    });

    expect(res.txHash).toBe("mock_tx_hash");
    expect(res.assetCode).toBe("TESTCODE");
    expect(res.issuer).toBe(publicKey);

    expect(loadAccountSpy).toHaveBeenCalledWith(publicKey);
    expect(submitTransactionSpy).toHaveBeenCalled();

    // Check the submitted transaction
    const submittedTx = submitTransactionSpy.mock.calls[0][0];
    expect(submittedTx.operations.length).toBe(1);
    expect(submittedTx.operations[0].type).toBe("manageData");
    expect(submittedTx.operations[0].name).toBe("PROJECT_proj-123");

    const expectedValue = JSON.stringify({
      asset: "TESTCODE",
      supply: 1000,
      name: "Test Project",
      nftUid: "nft-456"
    }).substring(0, 64);

    // value is a Buffer in manageData operation
    const valueStr = submittedTx.operations[0].value.toString();
    expect(valueStr).toBe(expectedValue);
  });

  test("createProjectAsset handles assetCode and project data truncation", async () => {
    const env = { STELLAR_KATE_SECRET_KEY: StellarSdk.Keypair.random().secret() };
    const client = new StellarClient(env);
    const publicKey = client.getKatePublicKey();

    const mockAccount = new StellarSdk.Account(publicKey, "123456");

    spyOn(StellarSdk.Horizon.Server.prototype, "loadAccount").mockResolvedValue(mockAccount as any);

    const submitTransactionSpy = spyOn(StellarSdk.Horizon.Server.prototype, "submitTransaction")
      .mockResolvedValue({ hash: "mock_tx_hash_2" } as any);

    const veryLongAssetCode = "SUPERLONGASSETCODE1234";
    const res = await client.createProjectAsset(veryLongAssetCode, 5000, {
      projectId: "verylongprojectid-001",
      projectName: "This is a very long project name that will be truncated"
    });

    expect(res.assetCode).toBe("SUPERLONGASS"); // First 12 characters, uppercase

    const submittedTx = submitTransactionSpy.mock.calls[0][0];

    expect(submittedTx.operations[0].name).toBe("PROJECT_verylongpr"); // "PROJECT_" + 10 chars

    const valueStr = submittedTx.operations[0].value.toString();
    expect(valueStr.length).toBeLessThanOrEqual(64);
    expect(valueStr).toContain('"asset":"SUPERLONGASS"');
    // Name will be cut off somewhere since the whole JSON is truncated to 64 chars
    expect(valueStr).toContain('"name":"This is a ');
  });

  test("createProjectAsset handles API errors properly", async () => {
    const env = { STELLAR_KATE_SECRET_KEY: StellarSdk.Keypair.random().secret() };
    const client = new StellarClient(env);

    spyOn(StellarSdk.Horizon.Server.prototype, "loadAccount").mockRejectedValue(new Error("Network Error"));

    expect(client.createProjectAsset("TESTCODE", 1000, {
      projectId: "proj-123",
      projectName: "Test Project"
    })).rejects.toThrow("Network Error");
  });
});
