import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '../init'
import { createStellarClient } from '@/lib/stellar/client'
import { getUserPublicKey } from '@/lib/stellar/wallet'

const stellarEnv = {
  STELLAR_KATE_SECRET_KEY: process.env.STELLAR_KATE_SECRET_KEY,
  STELLAR_USE_TESTNET:     process.env.STELLAR_USE_TESTNET ?? 'true',
  STELLAR_SIMULATION_MODE: process.env.STELLAR_SIMULATION_MODE ?? 'true',
}

export const secondaryRouter = router({
  /** List open intentions for a token asset */
  listIntentions: protectedProcedure
    .input(z.object({
      token_asset_id: z.string(),
      type:           z.enum(['buy', 'sell']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.secondaryIntention.findMany({
        where: {
          token_asset_id:  input.token_asset_id,
          status:          'open',
          intention_type:  input.type,
        },
        include: {
          user:        { select: { full_name: true } },
          token_asset: true,
        },
        orderBy: { created_at: 'desc' },
      })
    }),

  /** Create a buy or sell intention */
  createIntention: protectedProcedure
    .input(z.object({
      token_asset_id:  z.string(),
      intention_type:  z.enum(['buy', 'sell']),
      quantity:        z.number().positive(),
      price_per_token: z.number().positive(),
      expires_at:      z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const total_value = input.quantity * input.price_per_token

      // Validate seller has position
      if (input.intention_type === 'sell') {
        const validPositionCount = await ctx.prisma.investorPosition.count({
          where: {
            user_id:        ctx.userId,
            token_asset_id: input.token_asset_id,
            quantity:       { gte: input.quantity },
          },
        })
        if (validPositionCount === 0) {
          throw new Error('Insufficient token balance for this sale')
        }
      }

      return ctx.prisma.secondaryIntention.create({
        data: {
          ...input,
          user_id:     ctx.userId,
          total_value,
          status:      'open',
          expires_at:  input.expires_at ? new Date(input.expires_at) : null,
        },
      })
    }),

  /** Cancel an intention (own only) */
  cancelIntention: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const intention = await ctx.prisma.secondaryIntention.findFirst({
        where: { id: input.id, user_id: ctx.userId },
      })
      if (!intention) throw new Error('Intention not found or not yours')

      return ctx.prisma.secondaryIntention.update({
        where: { id: input.id },
        data:  { status: 'cancelled' },
      })
    }),

  /** [ADMIN] Execute a secondary trade on-chain */
  executeTrade: adminProcedure
    .input(z.object({
      seller_intention_id: z.string(),
      buyer_intention_id:  z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [sellerIntent, buyerIntent] = await Promise.all([
        ctx.prisma.secondaryIntention.findUnique({
          where: { id: input.seller_intention_id },
          include: { token_asset: true, user: true },
        }),
        ctx.prisma.secondaryIntention.findUnique({
          where: { id: input.buyer_intention_id },
          include: { token_asset: true, user: true },
        }),
      ])

      if (!sellerIntent || !buyerIntent) throw new Error('Intentions not found')
      if (sellerIntent.token_asset_id !== buyerIntent.token_asset_id) {
        throw new Error('Intentions are for different assets')
      }

      const quantity = Math.min(sellerIntent.quantity ?? 0, buyerIntent.quantity ?? 0)

      // Get buyer's Stellar public key
      const buyerPublicKey = await getUserPublicKey(buyerIntent.user_id)
      if (!buyerPublicKey) throw new Error('Buyer has no Stellar wallet')

      // Execute on Stellar
      const client = createStellarClient(stellarEnv)
      const assetCode = sellerIntent.token_asset.token_symbol ?? 'KTOKEN'
      const txResult = await client.transferTokens(
        buyerPublicKey,
        assetCode,
        quantity,
        `KATE_TRADE_${Date.now()}`
      )

      if (!txResult.success) throw new Error(txResult.error || 'Stellar transfer failed')

      // Create trade record
      const trade = await ctx.prisma.secondaryTrade.create({
        data: {
          token_asset_id:   sellerIntent.token_asset_id,
          seller_id:        sellerIntent.user_id,
          buyer_id:         buyerIntent.user_id,
          quantity,
          price_per_token:  sellerIntent.price_per_token,
          total_value_brz:  quantity * (sellerIntent.price_per_token ?? 0),
          status:           'executed',
          blockchain_tx_hash: txResult.txHash,
          executed_at:      new Date(),
        },
      })

      // Update intentions status
      await ctx.prisma.secondaryIntention.updateMany({
        where: { id: { in: [input.seller_intention_id, input.buyer_intention_id] } },
        data:  { status: 'executed' },
      })

      return { trade, txHash: txResult.txHash }
    }),

  /** Get recent trades for a token */
  listTrades: protectedProcedure
    .input(z.object({ token_asset_id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.secondaryTrade.findMany({
        where:   { token_asset_id: input.token_asset_id, status: 'executed' },
        orderBy: { executed_at: 'desc' },
        take:    50,
        select: {
          id: true, quantity: true, price_per_token: true,
          total_value_brz: true, blockchain_tx_hash: true, executed_at: true,
        },
      })
    }),

  /** Get ALL open intentions across all tokens (public classified board) */
  getOpenIntentions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.secondaryIntention.findMany({
      where: { status: 'open' },
      include: {
        token_asset: {
          include: {
            issuer: { select: { trade_name: true, legal_name: true } },
          },
        },
        user: { select: { full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    })
  }),
})
