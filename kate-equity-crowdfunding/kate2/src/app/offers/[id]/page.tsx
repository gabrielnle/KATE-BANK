import prisma from '@/lib/prisma'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, Shield, Calendar, TrendingUp,
  FileText, AlertTriangle, ExternalLink, Users, FolderLock
} from 'lucide-react'
import { PremiumDocumentList } from '@/components/PremiumDocumentList'
import { InvestCheckoutCard } from '@/components/InvestCheckoutCard'
import type { Metadata } from 'next'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { issuer: true },
  }).catch(() => null)
  if (!offer) return { title: 'Oferta não encontrada' }
  return {
    title: offer.title || offer.issuer.trade_name || offer.issuer.legal_name,
    description: `Oferta de ${offer.security_type === 'equity' ? 'equity' : 'dívida'} — Meta R$ ${(offer.max_target ?? 0).toLocaleString('pt-BR')}`,
  }
}

export default async function OfferDetailPage({ params }: Props) {
  const { id } = await params

  const [offer, reservationAgg] = await Promise.all([
    prisma.offer.findUnique({
      where: { id },
      include: {
        issuer:                { include: { controllers: true } },
        offer_documents:       true,
        essential_offer_infos: { take: 1 },
        token_assets:          true,
      },
    }).catch(() => null),
    prisma.reservation.aggregate({
      where: { offer_id: id, status: { in: ['confirmed', 'settled'] } },
      _sum: { amount_brz: true, token_quantity: true },
      _count: { id: true },
    }).catch(() => null)
  ])

  if (!offer) notFound()

  const raised       = reservationAgg?._sum?.amount_brz ?? 0
  const tokensIssued = reservationAgg?._sum?.token_quantity ?? 0
  const progress     = offer.max_target ? Math.min((raised / offer.max_target) * 100, 100) : 0
  const investorCount = reservationAgg?._count?.id ?? 0
  const tokenAsset   = offer.token_assets[0]
  const info         = offer.essential_offer_infos[0]
  const daysLeft     = offer.end_date
    ? Math.max(0, Math.ceil((new Date(offer.end_date).getTime() - Date.now()) / 86400000))
    : null

  const statusLabel: Record<string, { label: string; color: string }> = {
    active:    { label: 'Aberta',     color: 'text-green-400 bg-green-400/10 border-green-400/20' },
    draft:     { label: 'Rascunho',   color: 'text-white/50 bg-white/5 border-white/10' },
    funded:    { label: 'Financiada', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
    failed:    { label: 'Encerrada',  color: 'text-red-400 bg-red-400/10 border-red-400/20' },
    cancelled: { label: 'Cancelada',  color: 'text-red-400 bg-red-400/10 border-red-400/20' },
  }
  const st = statusLabel[offer.status ?? 'draft'] ?? statusLabel['draft']

  // Serialize documents for client component
  const docsForClient = offer.offer_documents.map(d => ({
    id: d.id,
    document_type: d.document_type,
    file_url: d.file_url,
    is_public: d.is_public,
    isPremium: d.isPremium,
    priceXLM: d.priceXLM,
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link href="/offers" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={14} /> Voltar às ofertas
      </Link>

      {/* Header Banner */}
      <div className="relative bg-gradient-to-br from-kate-dark-blue to-[#0f1e3d] border border-white/10 rounded-2xl overflow-hidden mb-8 p-8 md:p-10">
        <div className="absolute inset-0 opacity-10 select-none flex items-center justify-end pr-10">
          <span className="text-[180px] font-black text-white leading-none">
            {(offer.issuer.trade_name || offer.issuer.legal_name).substring(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="relative z-10">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${st.color}`}>
              {st.label}
            </span>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-kate-yellow/10 border border-kate-yellow/20 text-kate-yellow uppercase">
              {offer.security_type === 'equity' ? 'Equity' : offer.security_type === 'convertible_debt' ? 'Dívida Conversível' : 'Dívida Simples'}
            </span>
            {tokenAsset && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                Token: {tokenAsset.token_symbol}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-1">
            {offer.title || offer.issuer.trade_name || offer.issuer.legal_name}
          </h1>
          <p className="text-white/50">{offer.issuer.trade_name} · {offer.issuer.sector}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Company Info */}
          <section className="bg-kate-dark-blue border border-white/10 rounded-2xl p-6">
            <h2 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
              <Shield size={18} className="text-kate-yellow" /> Sobre a Empresa
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Razão Social',  value: offer.issuer.legal_name },
                { label: 'Nome Comercial', value: offer.issuer.trade_name },
                { label: 'CNPJ',          value: offer.issuer.cnpj },
                { label: 'Setor',         value: offer.issuer.sector },
                { label: 'Tipo Jurídico', value: offer.issuer.legal_type },
                { label: 'Website',       value: offer.issuer.website, isLink: true },
              ].filter(f => f.value).map(f => (
                <div key={f.label}>
                  <span className="text-white/40 block mb-0.5">{f.label}</span>
                  {f.isLink && /^https?:\/\//i.test(f.value!) ? (
                    <a href={f.value!} target="_blank" rel="noopener noreferrer"
                      className="text-kate-yellow hover:underline flex items-center gap-1">
                      {f.value} <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-white font-medium">{f.value}</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Offer Info */}
          {info?.company_info && (
            <section className="bg-kate-dark-blue border border-white/10 rounded-2xl p-6">
              <h2 className="font-bold text-white text-lg mb-3 flex items-center gap-2">
                <FileText size={18} className="text-kate-yellow" /> Informações Essenciais
              </h2>
              <div className="text-sm text-white/60 leading-relaxed whitespace-pre-line">
                {info.company_info}
              </div>
            </section>
          )}

          {/* Data Room (Documents with Premium Lock) */}
          {offer.offer_documents.length > 0 && (
            <section className="bg-kate-dark-blue border border-white/10 rounded-2xl p-6">
              <h2 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                <FolderLock size={18} className="text-kate-yellow" /> Data Room
              </h2>
              <PremiumDocumentList documents={docsForClient} offerId={offer.id} />
            </section>
          )}

          {/* Blockchain / Token */}
          {tokenAsset && (
            <section className="bg-kate-dark-blue border border-white/10 rounded-2xl p-6">
              <h2 className="font-bold text-white text-lg mb-4">Token na Stellar Network</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-white/40 block mb-0.5">Símbolo</span><span className="text-kate-yellow font-bold font-mono">{tokenAsset.token_symbol}</span></div>
                <div><span className="text-white/40 block mb-0.5">Nome</span><span className="text-white">{tokenAsset.token_name}</span></div>
                <div><span className="text-white/40 block mb-0.5">Tipo</span><span className="text-white">{tokenAsset.token_type ?? 'rwa_security_token'}</span></div>
                <div><span className="text-white/40 block mb-0.5">Oferta Total</span><span className="text-white">{(tokenAsset.total_supply ?? 0).toLocaleString('pt-BR')} tokens</span></div>
              </div>
            </section>
          )}

          {/* Controllers */}
          {offer.issuer.controllers.length > 0 && (
            <section className="bg-kate-dark-blue border border-white/10 rounded-2xl p-6">
              <h2 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                <Users size={18} className="text-kate-yellow" /> Controladores
              </h2>
              <div className="space-y-3">
                {offer.issuer.controllers.map(c => (
                  <div key={c.id} className="flex justify-between text-sm border-b border-white/5 pb-3">
                    <div>
                      <span className="text-white font-medium">{c.name}</span>
                      {c.cpf_cnpj && <span className="text-white/40 ml-2">· {c.cpf_cnpj}</span>}
                    </div>
                    <span className="text-kate-yellow font-semibold">{c.ownership_percentage}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Risk Warning */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex gap-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200/70">
              <strong className="text-amber-400 block mb-1">Alerta de Risco CVM</strong>
              O investimento em valores mobiliários de startups envolve riscos substanciais,
              incluindo a possibilidade de perda total do capital investido. Não invista
              mais do que pode perder.
            </div>
          </div>
        </div>

        {/* Right: Invest Card */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 bg-kate-dark-blue border border-white/10 rounded-2xl p-6 space-y-5">
            <h3 className="font-bold text-white text-lg">Investir nesta Oferta</h3>

            {/* Giant Animated Progress Bar */}
            <div>
              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="text-white/40 text-xs mb-0.5">Captado</p>
                  <p className="text-white font-extrabold text-2xl tracking-tight">
                    R$ {raised.toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/40 text-xs mb-0.5">Meta Máxima</p>
                  <p className="text-white/70 font-bold text-sm">
                    R$ {(offer.max_target ?? 0).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Bar container */}
              <div className="relative h-5 bg-white/[0.06] rounded-full overflow-visible mb-2">
                {/* Animated fill */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-kate-yellow/80 via-kate-yellow to-amber-400"
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {/* Glow on tip */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-kate-yellow shadow-[0_0_12px_rgba(252,163,16,0.6)]" />
                </div>

                {/* Min target (2/3) marker */}
                {offer.min_target && offer.max_target && (
                  <div
                    className="absolute top-0 bottom-0 flex flex-col items-center"
                    style={{ left: `${((offer.min_target / offer.max_target) * 100).toFixed(1)}%` }}
                  >
                    <div className="w-0.5 h-full bg-emerald-400/50" />
                    <div className="absolute -bottom-5 -translate-x-1/2 left-1/2 whitespace-nowrap">
                      <span className="text-[9px] font-bold text-emerald-400/70 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">
                        Meta Mín.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Labels row */}
              <div className="flex justify-between items-center text-xs mt-4">
                <span className={`font-bold ${progress >= 100 ? 'text-emerald-400' : 'text-kate-yellow'}`}>
                  {progress.toFixed(1)}%
                </span>
                <div className="flex items-center gap-3">
                  {offer.min_target && (
                    <span className="text-emerald-400/60 text-[10px]">
                      Mín: R$ {offer.min_target.toLocaleString('pt-BR')}
                    </span>
                  )}
                  <span className="text-white/30">
                    {investorCount} investidor{investorCount !== 1 ? 'es' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Preço/Token', value: `R$ ${(offer.unit_price ?? 0).toLocaleString('pt-BR')}` },
                { label: 'Mín. Investimento', value: `R$ ${(offer.min_investment ?? 0).toLocaleString('pt-BR')}` },
                { label: 'Investidores', value: investorCount.toString() },
                { label: 'Tokens Emitidos', value: tokensIssued.toLocaleString('pt-BR') },
                ...(daysLeft !== null ? [{ label: 'Dias Restantes', value: daysLeft > 0 ? `${daysLeft} dias` : 'Encerrada' }] : []),
                { label: 'Período Desistência', value: `${offer.withdrawal_period_days ?? 5} dias` },
              ].map(s => (
                <div key={s.label} className="bg-white/5 rounded-xl p-3">
                  <span className="text-white/40 text-xs block mb-1">{s.label}</span>
                  <span className="text-white font-bold text-sm">{s.value}</span>
                </div>
              ))}
            </div>

            {/* Deadline */}
            {offer.end_date && (
              <div className="flex items-center gap-2 text-xs text-white/40">
                <Calendar size={12} />
                Encerra em {new Date(offer.end_date).toLocaleDateString('pt-BR')}
              </div>
            )}

            {/* Investment Checkout (Client Component) */}
            <InvestCheckoutCard
              offerId={offer.id}
              unitPrice={offer.unit_price ?? 0}
              minInvestment={offer.min_investment ?? 100}
              isActive={offer.status === 'active'}
              statusLabel={st.label}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
