'use client'

import { useMemo } from 'react'
import { trpc } from '@/lib/trpc/client'
import { Wallet, Landmark, TrendingUp } from 'lucide-react'

export function DashboardKPICards() {
  const balances = trpc.stellar.getLiveBalances.useQuery(undefined, { refetchInterval: 30_000 })
  const positions = trpc.investors.getMyPositions.useQuery()
  const reservations = trpc.investors.getMyReservations.useQuery()

  const isLoading = balances.isLoading || positions.isLoading || reservations.isLoading

  // Calculate values
  const brzBalance = parseFloat(balances.data?.brz ?? '0')

  // ⚡ Bolt: Memoize expensive array reductions to prevent recalculation on every render
  const totalRWA = useMemo(() => {
    return (positions.data ?? []).reduce((sum, p) => {
      return sum + (p.quantity ?? 0) * (p.offer?.unit_price ?? 0)
    }, 0)
  }, [positions.data])

  // ⚡ Bolt: Memoize array filtering and reduction
  const totalInvested = useMemo(() => {
    return (reservations.data ?? [])
      .filter(r => ['confirmed', 'settled', 'pending_escrow'].includes(r.status ?? ''))
      .reduce((sum, r) => sum + (r.amount_brz ?? 0), 0)
  }, [reservations.data])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-kate-dark-blue border border-white/10 rounded-2xl p-5 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10" />
              <div className="flex-1">
                <div className="h-3 w-24 bg-white/10 rounded mb-2" />
                <div className="h-5 w-32 bg-white/5 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      icon: Wallet,
      label: 'Saldo Disponível',
      value: `R$ ${brzBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: 'BRZ na Wallet',
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
      glow: 'shadow-emerald-500/5',
    },
    {
      icon: Landmark,
      label: 'Patrimônio RWA',
      value: `R$ ${totalRWA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: `${(positions.data ?? []).length} ativo${(positions.data ?? []).length !== 1 ? 's' : ''}`,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      glow: 'shadow-purple-500/5',
    },
    {
      icon: TrendingUp,
      label: 'Total Investido',
      value: `R$ ${totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      sub: 'Reservas confirmadas',
      color: 'text-kate-yellow',
      bg: 'bg-kate-yellow/10',
      glow: 'shadow-kate-yellow/5',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {cards.map(k => (
        <div
          key={k.label}
          className={`bg-kate-dark-blue border border-white/10 rounded-2xl p-5 flex items-center gap-4 shadow-lg ${k.glow} relative overflow-hidden`}
        >
          {/* Subtle glow */}
          <div className={`absolute -top-8 -right-8 w-24 h-24 ${k.bg} rounded-full blur-2xl opacity-50 pointer-events-none`} />

          <div className={`w-12 h-12 rounded-xl ${k.bg} flex items-center justify-center shrink-0 relative`}>
            <k.icon size={22} className={k.color} />
          </div>
          <div className="relative">
            <p className="text-white/40 text-xs mb-0.5">{k.label}</p>
            <p className={`font-bold text-lg ${k.color}`}>{k.value}</p>
            <p className="text-white/20 text-[10px]">{k.sub}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
