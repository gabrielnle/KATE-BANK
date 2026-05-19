import { z } from 'zod'
import { router, adminProcedure } from '../init'
import { createStellarClient } from '@/lib/stellar/client'
import { createWalletForUser } from '@/lib/stellar/wallet'

const stellarEnv = {
  STELLAR_KATE_SECRET_KEY:  process.env.STELLAR_KATE_SECRET_KEY,
  STELLAR_KATE_PUBLIC_KEY:  process.env.STELLAR_KATE_PUBLIC_KEY,
  STELLAR_USE_TESTNET:      process.env.STELLAR_USE_TESTNET ?? 'true',
  STELLAR_SIMULATION_MODE:  process.env.STELLAR_SIMULATION_MODE ?? 'true',
}

export const adminRouter = router({
  /** Platform KPIs */
  getKpis: adminProcedure.query(async ({ ctx }) => {
    const [
      totalUsers,
      totalIssuers,
      totalOffers,
      activeOffers,
      pendingReservations,
      reservationsAgg,
      totalWallets,
    ] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.issuer.count(),
      ctx.prisma.offer.count(),
      ctx.prisma.offer.count({ where: { status: 'active' } }),
      ctx.prisma.reservation.count({ where: { status: 'pending' } }),
      ctx.prisma.reservation.aggregate({
        where: { status: { in: ['confirmed', 'settled'] } },
        _sum:  { amount_brz: true },
        _count: { id: true },
      }),
      ctx.prisma.wallet.count(),
    ])

    return {
      totalUsers,
      totalIssuers,
      totalOffers,
      activeOffers,
      pendingReservations,
      totalRaisedBrz:     reservationsAgg._sum.amount_brz ?? 0,
      totalInvestments:   reservationsAgg._count.id,
      totalWallets,
    }
  }),

  /** Token jobs: pending token emissions after confirmed reservations */
  listPendingTokenJobs: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.reservation.findMany({
      where:   { status: 'confirmed', blockchain_tx_hash: null },
      include: {
        investor: { include: { wallet: true } },
        offer:    { include: { token_assets: true, issuer: true } },
      },
      orderBy: { confirmed_at: 'asc' },
    })
  }),

  /** Mark reservation as settled (tokens emitted on Stellar) */
  settleReservation: adminProcedure
    .input(z.object({
      reservation_id:    z.string(),
      blockchain_tx_hash: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const reservation = await ctx.prisma.reservation.update({
        where: { id: input.reservation_id },
        data:  { status: 'settled', blockchain_tx_hash: input.blockchain_tx_hash },
        include: { offer: { include: { token_assets: true } } },
      })

      // Update investor position
      const tokenAsset = reservation.offer.token_assets[0]
      if (tokenAsset) {
        await ctx.prisma.investorPosition.upsert({
          where: {
            // composite not directly supported, use findFirst + create/update
            id: `${reservation.investor_id}-${tokenAsset.id}`,
          },
          create: {
            id:                `${reservation.investor_id}-${tokenAsset.id}`,
            user_id:           reservation.investor_id,
            issuer_id:         reservation.offer.issuer_id,
            offer_id:          reservation.offer_id,
            token_asset_id:    tokenAsset.id,
            quantity:          reservation.token_quantity ?? 0,
            average_price:     reservation.unit_price,
            acquisition_origin: 'primary',
            last_updated_at:   new Date(),
          },
          update: {
            quantity:       { increment: reservation.token_quantity ?? 0 },
            last_updated_at: new Date(),
          },
        })
      }

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          actor_user_id: ctx.userId,
          action:        'settle_reservation',
          entity_type:   'reservation',
          entity_id:     input.reservation_id,
          new_value:     JSON.stringify({ blockchain_tx_hash: input.blockchain_tx_hash }),
        },
      })

      return reservation
    }),

  /** Get audit log */
  getAuditLog: adminProcedure
    .input(z.object({
      limit:       z.number().default(100),
      entity_type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.auditLog.findMany({
        where:   { entity_type: input.entity_type },
        include: { actor: { select: { email: true, full_name: true } } },
        take:    input.limit,
        orderBy: { created_at: 'desc' },
      })
    }),

  /** Get compliance checks */
  listComplianceChecks: adminProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.complianceCheck.findMany({
        where:   { status: input.status },
        include: { reviewer: { select: { email: true, full_name: true } } },
        orderBy: { created_at: 'desc' },
      })
    }),

  /** Get all users (with KYC info) */
  listUsers: adminProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findMany({
        include: { investor_profile: true, wallet: true },
        take:    input.limit,
        skip:    input.offset,
        orderBy: { created_at: 'desc' },
      })
    }),

  /** Update user role */

  /** [ADMIN] Create wallet for a user */
  createWalletForUser: adminProcedure
    .input(z.object({ user_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.wallet.findUnique({
        where: { user_id: input.user_id },
      })
      if (existing) {
        return { publicKey: existing.stellar_public_key, alreadyExisted: true }
      }

      const { publicKey } = await createWalletForUser(input.user_id)

      // On testnet/simulation: fund with Friendbot
      if (stellarEnv.STELLAR_USE_TESTNET !== 'false') {
        const client = createStellarClient(stellarEnv)
        await client.fundTestnetAccount(publicKey).catch(() => null)
      }

      await ctx.prisma.auditLog.create({
        data: {
          actor_user_id: ctx.userId,
          action: 'admin_create_wallet',
          entity_type: 'wallet',
          entity_id: input.user_id,
          new_value: JSON.stringify({ publicKey }),
        },
      })

      return { publicKey, alreadyExisted: false }
    }),

  updateUserRole: adminProcedure
    .input(z.object({
      user_id: z.string(),
      role:    z.enum(['investor', 'issuer', 'admin']),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.user_id },
        data:  { role: input.role },
      })
    }),

  /** [ADMIN] Update investor type (e.g., promote to qualified/professional) */
  updateInvestorStatus: adminProcedure
    .input(z.object({
      user_id: z.string(),
      investor_type: z.enum(['retail', 'qualified', 'professional', 'lead']),
    }))
    .mutation(async ({ ctx, input }) => {
      const existingProfile = await ctx.prisma.investorProfile.findUnique({
        where: { user_id: input.user_id },
      })

      if (!existingProfile) {
        throw new Error('Investor profile not found')
      }

      let annual_limit: number | null | undefined
      if (input.investor_type === 'qualified' || input.investor_type === 'professional') {
        annual_limit = null // No limit
      } else if (existingProfile.is_active_investor) {
        annual_limit = 20000
      } else {
        const income = existingProfile.annual_income ?? 0
        const investments = existingProfile.financial_investments ?? 0
        annual_limit = Math.max(3000, Math.min(income * 0.1, investments * 0.1))
      }

      await ctx.prisma.auditLog.create({
        data: {
          actor_user_id: ctx.userId,
          action: 'update_investor_status',
          entity_type: 'investorProfile',
          entity_id: existingProfile.id,
          previous_value: JSON.stringify({ investor_type: existingProfile.investor_type }),
          new_value: JSON.stringify({ investor_type: input.investor_type }),
        },
      })

      return ctx.prisma.investorProfile.update({
        where: { user_id: input.user_id },
        data: {
          investor_type: input.investor_type,
          annual_limit,
        },
      })
    }),

  /** [ADMIN] Emit tokens for a single confirmed reservation via Stellar */
  processTokenJob: adminProcedure
    .input(z.object({ reservation_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const reservation = await ctx.prisma.reservation.findUniqueOrThrow({
        where:   { id: input.reservation_id },
        include: {
          investor: { include: { wallet: true } },
          offer:    { include: { token_assets: true, issuer: true } },
        },
      })

      if (reservation.status !== 'confirmed') {
        throw new Error('Reserva não está no status confirmado')
      }
      if (reservation.blockchain_tx_hash) {
        throw new Error('Tokens já foram emitidos para esta reserva')
      }

      const investorWallet = reservation.investor.wallet
      if (!investorWallet) throw new Error('Investidor sem carteira Stellar')

      const tokenAsset = reservation.offer.token_assets[0]
      if (!tokenAsset) throw new Error('Oferta sem token asset cadastrado')

      const client = createStellarClient(stellarEnv)

      // Transfer RWA tokens to investor wallet
      const result = await client.transferTokens(
        investorWallet.stellar_public_key,
        tokenAsset.token_symbol ?? 'RWA',
        reservation.token_quantity ?? 0,
        `INV-${reservation.id.slice(0, 8)}`
      )

      // Mark as settled and store tx hash
      await ctx.prisma.reservation.update({
        where: { id: input.reservation_id },
        data:  { status: 'settled', blockchain_tx_hash: result.txHash },
      })

      // Upsert investor position
      const posId = `${reservation.investor_id}-${tokenAsset.id}`
      await ctx.prisma.investorPosition.upsert({
        where:  { id: posId },
        create: {
          id:                 posId,
          user_id:            reservation.investor_id,
          issuer_id:          reservation.offer.issuer_id,
          offer_id:           reservation.offer_id,
          token_asset_id:     tokenAsset.id,
          quantity:           reservation.token_quantity ?? 0,
          average_price:      reservation.unit_price,
          acquisition_origin: 'primary',
          last_updated_at:    new Date(),
        },
        update: {
          quantity:        { increment: reservation.token_quantity ?? 0 },
          last_updated_at: new Date(),
        },
      })

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          actor_user_id: ctx.userId,
          action:        'process_token_job',
          entity_type:   'reservation',
          entity_id:     input.reservation_id,
          new_value:     JSON.stringify({ txHash: result.txHash, tokens: reservation.token_quantity }),
        },
      })

      return { txHash: result.txHash, tokens: reservation.token_quantity }
    }),

  /** [ADMIN] Emit tokens for ALL confirmed-but-unpaid reservations */
  processAllTokenJobs: adminProcedure.mutation(async ({ ctx }) => {
    const pending = await ctx.prisma.reservation.findMany({
      where:   { status: 'confirmed', blockchain_tx_hash: null },
      include: {
        investor: { include: { wallet: true } },
        offer:    { include: { token_assets: true } },
      },
    })

    const client  = createStellarClient(stellarEnv)
    const results = { success: 0, failed: 0, errors: [] as string[] }

    const promises = pending.map(async (reservation) => {
      const wallet     = reservation.investor.wallet
      const tokenAsset = reservation.offer.token_assets[0]
      if (!wallet || !tokenAsset) {
        throw new Error("Missing wallet or token asset")
      }

      const result = await client.transferTokens(
        wallet.stellar_public_key,
        tokenAsset.token_symbol ?? 'RWA',
        reservation.token_quantity ?? 0,
        `INV-${reservation.id.slice(0, 8)}`
      )

      await ctx.prisma.reservation.update({
        where: { id: reservation.id },
        data:  { status: 'settled', blockchain_tx_hash: result.txHash },
      })

      return reservation.id
    })

    const settledPromises = await Promise.allSettled(promises)

    for (let i = 0; i < settledPromises.length; i++) {
      const p = settledPromises[i]
      if (p.status === 'fulfilled') {
        results.success++
      } else {
        results.failed++
        results.errors.push(`${pending[i].id}: ${p.reason instanceof Error ? p.reason.message : String(p.reason)}`)
      }
    }

    await ctx.prisma.auditLog.create({
      data: {
        actor_user_id: ctx.userId,
        action:        'process_all_token_jobs',
        entity_type:   'reservation',
        entity_id:     'batch',
        new_value:     JSON.stringify(results),
      },
    })

    return results
  }),
})
