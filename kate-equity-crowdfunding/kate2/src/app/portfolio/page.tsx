'use client'
import { useMemo } from 'react'
import { trpc } from '@/lib/trpc/client'
import Link from 'next/link'
import { TrendingUp, Coins, ArrowUpRight, ExternalLink } from 'lucide-react'

export default function PortfolioPage() {
  const { data: positions, isLoading } = trpc.investors.getMyPositions.useQuery()
  const { data: reservations }         = trpc.investors.getMyReservations.useQuery()

  // ⚡ Bolt: Memoize expensive array reduction
  const totalValue = useMemo(() => {
    return (positions ?? []).reduce(
      (s: number, p: any) => s + (p.quantity ?? 0) * (p.average_price ?? 0),
      0
    )
  }, [positions])

  // ⚡ Bolt: Memoize array filtering
  const settledCount = useMemo(() => {
    return (reservations ?? []).filter((r: any) => r.status === 'settled').length
  }, [reservations])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <TrendingUp className="text-kate-yellow" /> Meu Portfólio
        </h1>
        <p className="text-white/40 text-sm mt-1">Posições em tokens Stellar</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-kate-dark-blue border border-white/10 rounded-2xl p-5">
          <p className="text-white/40 text-xs mb-1">Valor Total Estimado</p>
          <p className="text-green-400 font-black text-2xl">
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-kate-dark-blue border border-white/10 rounded-2xl p-5">
          <p className="text-white/40 text-xs mb-1">Ativos</p>
          <p className="text-kate-yellow font-black text-2xl">{(positions ?? []).length}</p>
        </div>
        <div className="bg-kate-dark-blue border border-white/10 rounded-2xl p-5">
          <p className="text-white/40 text-xs mb-1">Investimentos Liquidados</p>
          <p className="text-blue-400 font-black text-2xl">{settledCount}</p>
        </div>
      </div>

      {/* Positions */}
      <div className="bg-kate-dark-blue border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Coins size={16} className="text-kate-yellow" /> Tokens em Carteira
          </h2>
        </div>

        {isLoading && (
          <div className="text-center py-16 text-white/40 text-sm">Carregando posições...</div>
        )}
        {!isLoading && (positions ?? []).length === 0 && (
          <div className="text-center py-16">
            <Coins size={40} className="mx-auto text-white/10 mb-4" />
            <p className="text-white/40 text-sm">Nenhuma posição em portfólio.</p>
            <p className="text-white/20 text-xs mt-1">Invista em uma oferta para receber tokens Stellar.</p>
            <Link
              href="/offers"
              className="inline-flex items-center gap-2 mt-4 bg-kate-orange text-kate-navy font-bold px-4 py-2 rounded-xl text-sm hover:brightness-110 transition-all"
            >
              Ver Oportunidades <ArrowUpRight size={14} />
            </Link>
          </div>
        )}

        {(positions ?? []).length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Empresa', 'Token', 'Quantidade', 'Preço Médio', 'Valor Estimado', 'Origem', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-white/30 font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(positions as any[]).map((pos: any) => {
                const estimatedValue = (pos.quantity ?? 0) * (pos.average_price ?? 0)
                return (
                  <tr key={pos.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-white font-medium">
                        {pos.offer?.issuer?.trade_name ?? pos.offer?.issuer?.legal_name ?? '—'}
                      </p>
                      <p className="text-white/30 text-xs">
                        {new Date(pos.last_updated_at).toLocaleDateString('pt-BR')}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-kate-yellow font-mono text-sm font-bold">
                        {pos.token_asset?.token_symbol ?? '—'}
                      </code>
                    </td>
                    <td className="px-5 py-4 text-white font-semibold">
                      {(pos.quantity ?? 0).toFixed(4)}
                    </td>
                    <td className="px-5 py-4 text-white/60 text-xs">
                      R$ {(pos.average_price ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 text-green-400 font-semibold">
                      R$ {estimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        pos.acquisition_origin === 'primary'
                          ? 'bg-blue-400/10 text-blue-400'
                          : 'bg-purple-400/10 text-purple-400'
                      }`}>
                        {pos.acquisition_origin === 'primary' ? 'Mercado Primário' : 'Mercado Secundário'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {pos.token_asset?.token_symbol && (
                        <a
                          href={`https://stellar.expert/explorer/testnet/asset/${pos.token_asset.token_symbol}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/20 hover:text-kate-yellow transition-colors"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
