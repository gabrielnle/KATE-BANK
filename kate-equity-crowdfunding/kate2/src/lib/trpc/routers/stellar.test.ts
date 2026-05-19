import { describe, test, expect, mock, beforeEach } from "bun:test";

// We need to mock prisma
mock.module("@/lib/prisma", () => ({
  default: {
    wallet: {
      findUnique: mock(),
    },
  },
}));

// We need to mock the client simulation function
mock.module("@/lib/stellar/client", () => ({
  createStellarClient: mock(),
  simulatePixToBRZ: mock(),
}));

import { stellarRouter } from "./stellar";
import prisma from "@/lib/prisma";
import { simulatePixToBRZ } from "@/lib/stellar/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = any;

describe("Stellar Router", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("simulatePixDeposit", () => {
    test("throws error if wallet is not found", async () => {
      // Mock prisma to return null for the wallet
      const findUniqueMock = prisma.wallet.findUnique as AnyMock;
      findUniqueMock.mockResolvedValue(null);

      const caller = stellarRouter.createCaller({
        userId: "test-user-id",
        session: { user: { id: "test-user-id" } },
        userRole: "investor",
        prisma: prisma as AnyMock,
        req: {} as AnyMock
      });

      await expect(caller.simulatePixDeposit({ amount: "100.00" }))
        .rejects.toThrow("Wallet não encontrada. Complete o onboarding primeiro.");

      expect(prisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { user_id: "test-user-id" },
        select: { stellar_public_key: true, encrypted_secret: true },
      });
    });

    test("throws error if wallet exists but has no encrypted_secret", async () => {
      // Mock prisma to return a wallet without an encrypted_secret
      const findUniqueMock = prisma.wallet.findUnique as AnyMock;
      findUniqueMock.mockResolvedValue({
        stellar_public_key: "GBXYZ...",
        encrypted_secret: null,
      });

      const caller = stellarRouter.createCaller({
        userId: "test-user-id",
        session: { user: { id: "test-user-id" } },
        userRole: "investor",
        prisma: prisma as AnyMock,
        req: {} as AnyMock
      });

      await expect(caller.simulatePixDeposit({ amount: "100.00" }))
        .rejects.toThrow("Wallet não encontrada. Complete o onboarding primeiro.");

      expect(prisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { user_id: "test-user-id" },
        select: { stellar_public_key: true, encrypted_secret: true },
      });
    });

    test("successfully calls simulatePixToBRZ and returns result if wallet is valid", async () => {
      // Mock prisma to return a valid wallet
      const findUniqueMock = prisma.wallet.findUnique as AnyMock;
      findUniqueMock.mockResolvedValue({
        stellar_public_key: "GBXYZ...",
        encrypted_secret: "encrypted_secret_data",
      });

      // Mock the simulatePixToBRZ function to return a simulated response
      const mockResult = { txHash: "mocked_tx_hash", status: "success" };
      const simulatePixToBRZMock = simulatePixToBRZ as AnyMock;
      simulatePixToBRZMock.mockResolvedValue(mockResult);

      const caller = stellarRouter.createCaller({
        userId: "test-user-id",
        session: { user: { id: "test-user-id" } },
        userRole: "investor",
        prisma: prisma as AnyMock,
        req: {} as AnyMock
      });

      const result = await caller.simulatePixDeposit({ amount: "150.50" });

      // Verify prisma call
      expect(prisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { user_id: "test-user-id" },
        select: { stellar_public_key: true, encrypted_secret: true },
      });

      // Verify the simulated client method call
      expect(simulatePixToBRZ).toHaveBeenCalledWith(
        "GBXYZ...",
        "encrypted_secret_data",
        "150.50"
      );

      // Verify final result
      expect(result).toEqual(mockResult);
    });
  });
});
