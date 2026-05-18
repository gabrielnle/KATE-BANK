import { z } from 'zod'
import { router, publicProcedure, protectedProcedure, adminProcedure } from '../init'
import { createStellarClient, simulatePixToBRZ } from '@/lib/stellar/client'
import prisma from '@/lib/prisma'

const stellarEnv = {
  STELLAR_KATE_SECRET_KEY:  process.env.STELLAR_KATE_SECRET_KEY,
  STELLAR_KATE_PUBLIC_KEY:  process.env.STELLAR_KATE_PUBLIC_KEY,
  STELLAR_USE_TESTNET:      process.env.STELLAR_USE_TESTNET ?? 'true',
  STELLAR_SIMULATION_MODE:  process.env.STELLAR_SIMULATION_MODE ?? 'true',
}

export const stellarRouter = router({
  /** Health check — verify Stellar network connection */
  testConnection: publicProcedure.query(async () => {
    const client = createStellarClient(stellarEnv)
    return client.testConnection()
  }),

  /** Get config info (no secrets) */
  getConfig: publicProcedure.query(() => {
    return {
      isTestnet:    stellarEnv.STELLAR_USE_TESTNET !== 'false',
      isSimulated:  !stellarEnv.STELLAR_KATE_SECRET_KEY || stellarEnv.STELLAR_SIMULATION_MODE === 'true',
      katePublicKey: stellarEnv.STELLAR_KATE_PUBLIC_KEY || 'not-configured',
    }
  }),

  /** Get balances for a Stellar public key */
  getBalances: protectedProcedure
    .input(z.object({ publicKey: z.string() }))
    .query(async ({ input }) => {
      const client = createStellarClient(stellarEnv)
      return client.getAllBalances(input.publicKey)
    }),

  /** Get balance for a specific asset */
  getAssetBalance: protectedProcedure
    .input(z.object({ publicKey: z.string(), assetCode: z.string() }))
    .query(async ({ input }) => {
      const client = createStellarClient(stellarEnv)
      return client.getAssetBalance(input.publicKey, input.assetCode)
    }),

  /** [ADMIN] Create a project security token on Stellar */
  createProjectAsset: adminProcedure
    .input(z.object({
      assetCode:    z.string().max(12),
      totalSupply:  z.number().positive(),
      projectId:    z.string(),
      projectName:  z.string(),
      nftUid:       z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const client = createStellarClient(stellarEnv)
      return client.createProjectAsset(input.assetCode, input.totalSupply, {
        projectId:   input.projectId,
        projectName: input.projectName,
        nftUid:      input.nftUid,
      })
    }),

  /** [ADMIN] Transfer tokens to an investor after confirmed payment */
  transferTokens: adminProcedure
    .input(z.object({
      investorPublicKey: z.string(),
      assetCode:         z.string(),
      amount:            z.number().positive(),
      memo:              z.string().max(28).optional(),
    }))
    .mutation(async ({ input }) => {
      const client = createStellarClient(stellarEnv)
      return client.transferTokens(
        input.investorPublicKey,
        input.assetCode,
        input.amount,
        input.memo
      )
    }),

  /** [ADMIN] Create an NFT for project verification */
  createNFT: adminProcedure
    .input(z.object({
      nftCode:         z.string().max(12),
      projectId:       z.string(),
      projectName:     z.string(),
      verificationUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const client = createStellarClient(stellarEnv)
      return client.createNFT(input.nftCode, {
        projectId:       input.projectId,
        projectName:     input.projectName,
        verificationUrl: input.verificationUrl,
      })
    }),

  /** Create trustline for an investor (server-side custody) */
  createTrustline: adminProcedure
    .input(z.object({
      investorSecretKey: z.string(),
      assetCode:         z.string(),
      issuerPublicKey:   z.string(),
    }))
    .mutation(async ({ input }) => {
      const client = createStellarClient(stellarEnv)
      return client.createTrustline(
        input.investorSecretKey,
        input.assetCode,
        input.issuerPublicKey
      )
    }),

  /** Fund a testnet account via Friendbot */
  fundTestnetAccount: adminProcedure
    .input(z.object({ publicKey: z.string() }))
    .mutation(async ({ input }) => {
      const client = createStellarClient(stellarEnv)
      return client.fundTestnetAccount(input.publicKey)
    }),

  /** Get Stellar Explorer URL for a transaction */
  getExplorerUrl: publicProcedure
    .input(z.object({ txHash: z.string() }))
    .query(({ input }) => {
      const client = createStellarClient(stellarEnv)
      return { url: client.getExplorerUrl(input.txHash) }
    }),

  /** Simulate a PIX deposit → BRZ on Stellar Testnet */
  simulatePixDeposit: protectedProcedure
    .input(z.object({
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Fetch user's custodial wallet from DB
      const wallet = await prisma.wallet.findUnique({
        where: { user_id: ctx.userId },
        select: { stellar_public_key: true, encrypted_secret: true },
      })

      if (!wallet || !wallet.encrypted_secret) {
        throw new Error('Wallet não encontrada. Complete o onboarding primeiro.')
      }

      const result = await simulatePixToBRZ(
        wallet.stellar_public_key,
        wallet.encrypted_secret,
        input.amount
      )

      return result
    }),

  /**
   * Consulta de saldos on-chain via Horizon (Stellar Testnet).
   *
   * Conecta diretamente ao Horizon Node da Stellar Testnet para buscar os
   * saldos atualizados de BRZ (stablecoin) e XLM (nativo) na blockchain,
   * **ignorando o banco de dados local** para garantir transparência
   * regulatória conforme CVM 88.
   *
   * Este design garante que o saldo exibido ao investidor é sempre a
   * "fonte da verdade" on-chain, eliminando risco de discrepância entre
   * o estado do DB e o ledger real.
   *
   * @returns Saldos XLM e BRZ como strings, publicKey e flag hasWallet
   */
  getLiveBalances: protectedProcedure.query(async ({ ctx }) => {
    const wallet = await prisma.wallet.findUnique({
      where: { user_id: ctx.userId },
      select: { stellar_public_key: true },
    })

    if (!wallet) {
      return { xlm: '0', brz: '0', publicKey: null, hasWallet: false }
    }

    const StellarSdk = await import('@stellar/stellar-sdk')
    const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org')

    try {
      const account = await server.loadAccount(wallet.stellar_public_key)

      const xlm = account.balances.find((bal) => bal.asset_type === 'native')?.balance ?? '0'
      const brz = account.balances.find((bal) => bal.asset_type !== 'native' && 'asset_code' in bal && bal.asset_code === 'BRZ')?.balance ?? '0'

      return {
        xlm,
        brz,
        publicKey: wallet.stellar_public_key,
        hasWallet: true,
      }
    } catch (err) {
      // Account may not exist on-chain yet (not funded via Friendbot)
      console.error('[Horizon] Error fetching balances:', err)
      return {
        xlm: '0',
        brz: '0',
        publicKey: wallet.stellar_public_key,
        hasWallet: true,
      }
    }
  }),
})
