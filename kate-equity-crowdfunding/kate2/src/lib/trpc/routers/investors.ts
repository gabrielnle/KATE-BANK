import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '../init'

export const investorsRouter = router({
  /** Get current user profile with investor data */
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      include: { investor_profile: true },
    })
  }),

  /** Update user profile (name) */
  updateMyProfile: protectedProcedure
    .input(z.object({
      full_name: z.string().min(2).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { full_name: input.full_name },
      })
    }),

  /** Create or update investor profile (KYC data) */
  upsertProfile: protectedProcedure
    .input(z.object({
      annual_income:         z.number().optional(),
      financial_investments: z.number().optional(),
      risk_profile:          z.string().optional(),
      is_active_investor:    z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get existing profile to check current investor type (prevent self-certification bypass)
      const existingProfile = await ctx.prisma.investorProfile.findUnique({
        where: { user_id: ctx.userId },
        select: { investor_type: true },
      })

      const currentType = existingProfile?.investor_type ?? 'retail'

      // Calculate annual limit based on CVM 88 rules and existing type
      let annual_limit: number | null | undefined
      if (currentType === 'qualified' || currentType === 'professional') {
        annual_limit = null // No limit
      } else if (input.is_active_investor) {
        annual_limit = 20000 // R$ 20k for active retail investors per year per platform
      } else {
        // Retail: min(10% of income, 10% of investments) or R$3k, whichever is greater
        const income      = input.annual_income ?? 0
        const investments = input.financial_investments ?? 0
        annual_limit = Math.max(3000, Math.min(income * 0.1, investments * 0.1))
      }

      return ctx.prisma.investorProfile.upsert({
        where:  { user_id: ctx.userId },
        create: {
          ...input,
          user_id: ctx.userId,
          investor_type: 'retail', // Always default new profiles to retail
          annual_limit,
          used_limit: 0
        },
        update: { ...input, annual_limit },
      })
    }),

  /** Get investor's investment positions */
  getMyPositions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.investorPosition.findMany({
      where: { user_id: ctx.userId },
      include: {
        offer:       { include: { issuer: true } },
        token_asset: true,
      },
      orderBy: { last_updated_at: 'desc' },
    })
  }),

  /** Check if investor can invest a given amount (CVM 88 limit check) */
  checkLimit: protectedProcedure
    .input(z.object({ amount: z.number().positive() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.prisma.investorProfile.findUnique({
        where: { user_id: ctx.userId },
        select: { annual_limit: true, used_limit: true, investor_type: true },
      })
      if (!profile) return { canInvest: false, reason: 'Profile not found — complete KYC first' }

      // Qualified/Professional: no limit
      if (profile.investor_type === 'qualified' || profile.investor_type === 'professional') {
        return { canInvest: true, remaining: null }
      }

      const remaining = (profile.annual_limit ?? 0) - (profile.used_limit ?? 0)
      if (input.amount > remaining) {
        return {
          canInvest: false,
          reason:    `Annual limit exceeded. Remaining: R$ ${remaining.toLocaleString('pt-BR')}`,
          remaining,
        }
      }
      return { canInvest: true, remaining }
    }),

  /** Create a reservation (investment intent) */
  createReservation: protectedProcedure
    .input(z.object({
      offer_id:       z.string(),
      amount_brz:     z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const offer = await ctx.prisma.offer.findUnique({
        where: { id: input.offer_id },
        select: { unit_price: true, min_investment: true, status: true },
      })
      if (!offer || offer.status !== 'active') {
        throw new Error('Offer not available')
      }
      if (input.amount_brz < (offer.min_investment ?? 0)) {
        throw new Error(`Minimum investment is R$ ${offer.min_investment}`)
      }

      const token_quantity = input.amount_brz / (offer.unit_price ?? 1)
      const withdrawal_deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days

      const reservation = await ctx.prisma.reservation.create({
        data: {
          offer_id:            input.offer_id,
          investor_id:         ctx.userId,
          amount_brz:          input.amount_brz,
          token_quantity,
          unit_price:          offer.unit_price,
          status:              'pending',
          withdrawal_deadline,
        },
      })

      // Update used_limit (mock: will be finalized on payment confirmation)
      await ctx.prisma.investorProfile.update({
        where: { user_id: ctx.userId },
        data:  { used_limit: { increment: input.amount_brz } },
      })

      return reservation
    }),

  /** Get current user's reservations */
  getMyReservations: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.reservation.findMany({
      where:   { investor_id: ctx.userId },
      include: { offer: { include: { issuer: true } } },
      orderBy: { created_at: 'desc' },
    })
  }),

  /** [ADMIN] List all investors */
  listAll: adminProcedure
    .input(z.object({
      limit:  z.number().default(50),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findMany({
        where:   { role: { not: 'admin' } },
        include: { investor_profile: true, wallet: true },
        take:    input?.limit  ?? 50,
        skip:    input?.offset ?? 0,
        orderBy: { created_at: 'desc' },
      })
    }),

  /** [ADMIN] List pending reservations */
  listPendingReservations: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.reservation.findMany({
      where:   { status: 'pending' },
      include: {
        investor: { select: { email: true, full_name: true } },
        offer:    { include: { issuer: true } },
      },
      orderBy: { created_at: 'desc' },
    })
  }),

  /** [ADMIN] Confirm a reservation (mock payment confirmation) */
  confirmReservation: adminProcedure
    .input(z.object({ reservation_id: z.string(), blockchain_tx_hash: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.reservation.update({
        where: { id: input.reservation_id },
        data:  {
          status:              'confirmed',
          confirmed_at:        new Date(),
          blockchain_tx_hash:  input.blockchain_tx_hash,
        },
      })
    }),

  /** [ADMIN] Reject/refund a reservation */
  rejectReservation: adminProcedure
    .input(z.object({ reservation_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const reservation = await ctx.prisma.reservation.update({
        where: { id: input.reservation_id },
        data:  { status: 'refunded' },
      })
      // Rollback used_limit
      await ctx.prisma.investorProfile.update({
        where: { user_id: reservation.investor_id },
        data:  { used_limit: { decrement: reservation.amount_brz ?? 0 } },
      })
      return reservation
    }),
})
