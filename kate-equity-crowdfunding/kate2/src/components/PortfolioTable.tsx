'use client'

import { useMemo } from 'react'
import { trpc } from '@/lib/trpc/client'
import Link from 'next/link'
import { Briefcase, TrendingUp, ExternalLink, Layers } from 'lucide-react'

export function PortfolioTable() {
  const { data: positions, isLoading } = trpc.investors.getMyPositions.useQuery()

  const items = useMemo(() => positions ?? [], [positions])

  // ⚡ Bolt: Memoize expensive array reduction to prevent recalculation on every render
  const totalRWA = useMemo(() => {
    return items.reduce((sum, p) => {
      const qty = p.quantity ?? 0
      const price = p.offer?.unit_price ?? 0
      return sum + qty * price
    }, 0)
  }, [items])

  if (isLoading) {
    return (
      <div className="bg-kate-dark-blue border border-white/10 rounded-2xl p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-white/10" />
          <div className="h-4 w-32 bg-white/10 rounded" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-kate-dark-blue border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Briefcase size={18} className="text-purple-400" />
          </div>
          <div>
            <h2 className="font-bold text-white">Meu Portfólio</h2>
            <p className="text-white/30 text-xs">{items.length} posição{items.length !== 1 ? 'ões' : ''} ativas</p>
          </div>
        </div>
        {totalRWA > 0 && (
          <div className="text-right">
            <p className="text-white/40 text-[10px]">Patrimônio RWA</p>
            <p className="text-purple-400 font-bold text-sm">
              R$ {totalRWA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 px-6">
          <Layers size={36} className="mx-auto text-white/15 mb-3" />
          <p className="text-white/40 text-sm mb-2">Nenhum ativo no portfólio ainda.</p>
          <Link href="/offers" className="text-kate-yellow text-sm hover:underline">
            Explorar oportunidades →
          </Link>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-6 py-2 text-[10px] font-bold text-white/30 uppercase tracking-wider border-t border-white/[0.04]">
            <div className="col-span-4">Ativo</div>
            <div className="col-span-2 text-right">Tokens</div>
            <div className="col-span-2 text-right">Preço Unit.</div>
            <div className="col-span-2 text-right">Valor Total</div>
            <div className="col-span-2 text-right">Status</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/[0.04]">
            {items.map(pos => {
              const qty = pos.quantity ?? 0
              const price = pos.offer?.unit_price ?? 0
              const value = qty * price
              const symbol = pos.token_asset?.token_symbol ?? '—'
              const company = pos.offer?.issuer?.trade_name || pos.offer?.issuer?.legal_name || '—'

              const statusMap: Record<string, { label: string; cls: string }> = {
                primary:                  { label: 'Ativo',       cls: 'text-green-400 bg-green-400/10' },
                subsequent_transaction:   { label: 'Secundário',  cls: 'text-blue-400 bg-blue-400/10' },
                private_transfer:         { label: 'Transferido', cls: 'text-amber-400 bg-amber-400/10' },
              }
              const st = statusMap[pos.acquisition_origin ?? 'primary'] ?? statusMap['primary']

              return (
                <Link
                  key={pos.id}
                  href={`/offers/${pos.offer_id}`}
                  className="grid grid-cols-12 gap-2 px-6 py-4 hover:bg-white/[0.02] transition-colors group items-center"
                >
                  {/* Asset info */}
                  <div className="col-span-12 sm:col-span-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-kate-yellow/10 flex items-center justify-center shrink-0">
                      <span className="text-kate-yellow text-xs font-bold font-mono">{symbol.substring(0, 3)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate group-hover:text-kate-yellow transition-colors">
                        {company}
                      </p>
                      <p className="text-white/30 text-xs font-mono">{symbol}</p>
                    </div>
                  </div>

                  {/* Tokens */}
                  <div className="col-span-4 sm:col-span-2 text-right">
                    <p className="text-white font-bold text-sm">{qty.toLocaleString('pt-BR')}</p>
                    <p className="text-white/25 text-xs sm:hidden">tokens</p>
                  </div>

                  {/* Unit price */}
                  <div className="col-span-4 sm:col-span-2 text-right">
                    <p className="text-white/60 text-sm">R$ {price.toLocaleString('pt-BR')}</p>
                  </div>

                  {/* Total value */}
                  <div className="col-span-4 sm:col-span-2 text-right">
                    <p className="text-white font-bold text-sm">
                      R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:flex col-span-2 justify-end items-center gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>
                      {st.label}
                    </span>
                    <ExternalLink size={10} className="text-white/15" />
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
