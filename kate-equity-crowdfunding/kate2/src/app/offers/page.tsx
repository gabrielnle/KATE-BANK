import prisma from '@/lib/prisma'
import Link from 'next/link'
import { Search, SlidersHorizontal, TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Oportunidades de Investimento',
  description: 'Explore empresas em captação na blockchain Stellar. Invista a partir de R$ 100.',
}

const SECURITY_TYPES = [
  { value: '',                   label: 'Todos os Tipos' },
  { value: 'equity',             label: 'Equity' },
  { value: 'convertible_debt',   label: 'Dívida Conversível' },
  { value: 'non_convertible_debt', label: 'Dívida Simples' },
]

interface SearchParams { status?: string; type?: string; q?: string }

export default async function OffersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const securityType = params.type ?? ''

  const [offers, reservationsAgg] = await Promise.all([
    prisma.offer.findMany({
      where: {
        status:        params.status ?? 'active',
        security_type: securityType || undefined,
        ...(params.q ? {
          issuer: {
            OR: [
              { legal_name:  { contains: params.q } },
              { trade_name:  { contains: params.q } },
              { sector:      { contains: params.q } },
            ],
          },
        } : {}),
      },
      include: {
        issuer: true,
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.reservation.groupBy({
      by: ['offer_id'],
      where: { status: { in: ['confirmed', 'settled'] } },
      _sum: { amount_brz: true }
    })
  ]).catch(() => [[], []])

  // Map for O(1) lookups instead of .filter() and .reduce() on the full array
  const aggMap = new Map(
    reservationsAgg.map(agg => [
      agg.offer_id,
      agg._sum.amount_brz ?? 0
    ])
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <p className="text-kate-yellow text-sm font-semibold uppercase tracking-wider mb-2">Plataforma Kate Equity</p>
        <h1 className="text-3xl font-bold text-white">Oportunidades de Investimento</h1>
        <p className="text-white/50 mt-2">
          {offers.length} {offers.length === 1 ? 'oferta disponível' : 'ofertas disponíveis'}
        </p>
      </div>

      {/* Filters */}
      <form className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Buscar empresa, setor..."
            className="w-full bg-kate-dark-blue border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-kate-yellow/50 text-sm"
          />
        </div>
        <div className="relative">
          <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <select
            name="type"
            defaultValue={securityType}
            className="bg-kate-dark-blue border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-white text-sm focus:outline-none focus:border-kate-yellow/50 appearance-none cursor-pointer"
          >
            {SECURITY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="bg-kate-orange text-kate-navy font-bold px-5 py-2.5 rounded-xl text-sm hover:brightness-110 transition-all">
          Filtrar
        </button>
      </form>

      {/* Grid */}
      {offers.length === 0 ? (
        <div className="text-center py-20">
          <TrendingUp size={48} className="mx-auto text-white/20 mb-4" />
          <h3 className="text-white font-medium mb-2">Nenhuma oferta encontrada</h3>
          <p className="text-white/40 text-sm">Tente ajustar os filtros ou volte em breve.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map(offer => {
            // ⚡ Bolt: Offloaded to DB aggregate query to prevent loading all reservations into memory
            const raised = aggMap.get(offer.id) ?? 0
            const progress = offer.max_target ? Math.min((raised / offer.max_target) * 100, 100) : 0
            const daysLeft = offer.end_date
              ? Math.max(0, Math.ceil((new Date(offer.end_date).getTime() - Date.now()) / 86400000))
              : null

            return (
              <Link
                key={offer.id}
                href={`/offers/${offer.id}`}
                className="group bg-kate-dark-blue border border-white/10 rounded-2xl overflow-hidden hover:border-kate-yellow/30 hover:-translate-y-1 hover:shadow-xl hover:shadow-kate-yellow/10 transition-all"
              >
                {/* Cover */}
                <div className="h-40 bg-gradient-to-br from-kate-dark-blue to-[#1a2a4a] relative flex items-center justify-center">
                  <div className="text-5xl font-black text-white/5 select-none">
                    {(offer.issuer.trade_name || offer.issuer.legal_name).substring(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="bg-kate-yellow/20 text-kate-yellow text-xs font-bold px-2.5 py-1 rounded-full uppercase">
                      {offer.security_type === 'equity' ? 'Equity' : offer.security_type === 'convertible_debt' ? 'Div. Conv.' : 'Dívida'}
                    </span>
                    {offer.status === 'active' && (
                      <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Aberta
                      </span>
                    )}
                  </div>
                  {daysLeft !== null && (
                    <div className="absolute bottom-3 right-3 bg-black/50 text-white/70 text-xs px-2.5 py-1 rounded-full">
                      {daysLeft > 0 ? `${daysLeft} dias restantes` : 'Encerrada'}
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <h2 className="font-bold text-white text-lg leading-tight group-hover:text-kate-yellow transition-colors">
                    {offer.title || offer.issuer.trade_name || offer.issuer.legal_name}
                  </h2>
                  {offer.issuer.trade_name && offer.title && (
                    <p className="text-xs text-white/40 mt-0.5">{offer.issuer.trade_name}</p>
                  )}
                  <p className="text-xs text-white/40 mt-0.5">{offer.issuer.sector}</p>

                  {/* Progress */}
                  <div className="mt-4 mb-3">
                    <div className="flex justify-between text-xs text-white/40 mb-1.5">
                      <span>R$ {raised.toLocaleString('pt-BR')} captados</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-kate-yellow rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs pt-3 border-t border-white/5">
                    <div>
                      <span className="text-white/40">Mínimo</span>
                      <p className="text-white font-semibold">R$ {(offer.min_investment ?? 0).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-white/40">Meta</span>
                      <p className="text-white font-semibold">R$ {(offer.max_target ?? 0).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
