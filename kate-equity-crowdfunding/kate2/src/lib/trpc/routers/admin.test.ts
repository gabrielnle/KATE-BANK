import { test, expect, mock, describe } from 'bun:test';
import { adminRouter } from './admin';
import type { Context } from '../context';

// In tRPC v11, we create a caller directly using the router's createCaller function
const createCaller = adminRouter.createCaller;

describe('Admin Router', () => {
  describe('settleReservation', () => {
    test('handles reservation without token assets (missing token asset edge case)', async () => {
      // Mock prisma context
      const prismaMock = {
        reservation: {
          update: mock().mockResolvedValue({
            id: 'res_123',
            investor_id: 'inv_123',
            offer_id: 'off_123',
            offer: {
              issuer_id: 'iss_123',
              token_assets: [] // Empty token assets array tests the edge case
            }
          })
        },
        investorPosition: {
          upsert: mock().mockResolvedValue({})
        },
        auditLog: {
          create: mock().mockResolvedValue({})
        },
        $transaction: mock().mockImplementation(async (callback: (prisma: unknown) => Promise<unknown>) => {
          return callback(prismaMock);
        })
      };

      // Ensure mock user is authorized as admin
      const ctx = {
        prisma: prismaMock,
        userId: 'admin_123',
        userRole: 'admin',
        session: { user: { id: 'admin_123', role: 'admin' } }
      } as unknown as Context;

      const caller = createCaller(ctx);

      const result = await caller.settleReservation({
        reservation_id: 'res_123',
        blockchain_tx_hash: '0x123'
      });

      expect(result).toBeDefined();
      expect(prismaMock.reservation.update).toHaveBeenCalledTimes(1);
      // Ensure the upsert is NOT called when token_assets is empty
      expect(prismaMock.investorPosition.upsert).not.toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    });

    test('handles reservation with token assets', async () => {
      // Mock prisma context
      const prismaMock = {
        reservation: {
          update: mock().mockResolvedValue({
            id: 'res_123',
            investor_id: 'inv_123',
            offer_id: 'off_123',
            token_quantity: 100,
            unit_price: 10,
            offer: {
              issuer_id: 'iss_123',
              token_assets: [{ id: 'asset_123' }] // Has token asset
            }
          })
        },
        investorPosition: {
          upsert: mock().mockResolvedValue({})
        },
        auditLog: {
          create: mock().mockResolvedValue({})
        },
        $transaction: mock().mockImplementation(async (callback: (prisma: unknown) => Promise<unknown>) => {
          return callback(prismaMock);
        })
      };

      const ctx = {
        prisma: prismaMock,
        userId: 'admin_123',
        userRole: 'admin',
        session: { user: { id: 'admin_123', role: 'admin' } }
      } as unknown as Context;

      const caller = createCaller(ctx);

      const result = await caller.settleReservation({
        reservation_id: 'res_123',
        blockchain_tx_hash: '0x123'
      });

      expect(result).toBeDefined();
      expect(prismaMock.reservation.update).toHaveBeenCalledTimes(1);
      // Ensure the upsert IS called when token_assets is present
      expect(prismaMock.investorPosition.upsert).toHaveBeenCalledTimes(1);
      expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });
});
