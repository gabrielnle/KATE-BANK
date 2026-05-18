import prisma from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ListOrdered, Plus, ExternalLink } from 'lucide-react'

export const metadata: Metadata = { title: 'Ofertas' }

const statusLabel: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Rascunho',   cls: 'bg-white/10 text-white/50' },
  active:    { label: 'Ativa',      cls: 'bg-green-400/15 text-green-400' },
  funded:    { label: 'Captada',    cls: 'bg-blue-400/15 text-blue-400' },
  failed:    { label: 'Encerrada',  cls: 'bg-red-400/15 text-red-400' },
  cancelled: { label: 'Cancelada',  cls: 'bg-white/10 text-white/40' },
}

const secTypeLabel: Record<string, string> = {
  equity:               'Participação',
  convertible_debt:     'Dívida Conv.',
  non_convertible_debt: 'Dívida Simples',
}

export default async function AdminOfertasPage() {
  const [offers, reservationsAgg] = await Promise.all([
    prisma.offer.findMany({
      include: {
        issuer:       true,
        token_assets: true,
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.reservation.groupBy({
      by: ['offer_id'],
      where: { status: { in: ['confirmed', 'settled'] } },
      _sum: { amount_brz: true },
      _count: { id: true },
    })
  ]).catch(() => [[], []])

  // Map for O(1) lookups instead of .filter() and .reduce() on the full array
  const aggMap = new Map(
    reservationsAgg.map(agg => [
      agg.offer_id,
      { raised: agg._sum.amount_brz ?? 0, count: agg._count.id }
    ])
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ListOrdered className="text-kate-yellow" /> Ofertas
          </h1>
          <p className="text-white/40 text-sm mt-1">{offers.length} ofertas cadastradas</p>
        </div>
        <button className="flex items-center gap-2 bg-kate-orange text-kate-navy font-bold px-4 py-2 rounded-xl text-sm hover:brightness-110 transition-all">
          <Plus size={16} /> Nova Oferta
        </button>
      </div>

      <div className="bg-kate-dark-blue border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {['Empresa / Oferta', 'Tipo', 'Token', 'Meta', 'Captado', 'Investidores', 'Status', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 text-white/40 font-medium text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offers.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-16 text-white/30">Nenhuma oferta cadastrada.</td>
              </tr>
            )}
            {offers.map(offer => {
              // ⚡ Bolt: Offloaded to DB aggregate query to prevent loading all reservations into memory
              const agg = aggMap.get(offer.id) ?? { raised: 0, count: 0 }
              const raised = agg.raised
              const confirmedCount = agg.count
              const progress = offer.max_target ? Math.min((raised / offer.max_target) * 100, 100) : 0
              const st = statusLabel[offer.status ?? 'draft'] ?? statusLabel.draft

              return (
                <tr key={offer.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-white font-medium">{offer.issuer.trade_name ?? offer.issuer.legal_name}</p>
                    <p className="text-white/40 text-xs mt-0.5 truncate max-w-[180px]">{offer.title ?? '—'}</p>
                  </td>
                  <td className="px-5 py-4 text-white/60">{secTypeLabel[offer.security_type ?? ''] ?? offer.security_type}</td>
                  <td className="px-5 py-4">
                    <code className="text-kate-yellow font-mono text-xs">
                      {offer.token_assets[0]?.token_symbol ?? '—'}
                    </code>
                  </td>
                  <td className="px-5 py-4 text-white/80">
                    R$ {(offer.max_target ?? 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-white text-xs font-semibold">R$ {raised.toLocaleString('pt-BR')}</p>
                      <div className="w-24 h-1.5 bg-white/10 rounded-full mt-1">
                        <div
                          className="h-full bg-kate-yellow rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-white/30 text-xs mt-0.5">{progress.toFixed(0)}%</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-white/60">{confirmedCount}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/offers/${offer.id}`}
                      target="_blank"
                      className="text-white/30 hover:text-kate-yellow transition-colors"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
