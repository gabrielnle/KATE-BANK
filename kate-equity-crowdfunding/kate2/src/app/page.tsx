import Link from 'next/link'
import prisma from '@/lib/prisma'
import { ArrowRight, Shield, Zap, TrendingUp, Lock, Globe, CheckCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kate Equity | Investimento em Tokens na Blockchain Stellar',
  description: 'Invista em tokens lastreados em ativos reais com segurança, conformidade CVM 88 e tecnologia blockchain Stellar.',
}

const stats = [
  { label: 'Captado em Ofertas',   value: 'R$ 12M+' },
  { label: 'Investidores Ativos',  value: '3.800+' },
  { label: 'Empresas Financiadas', value: '47' },
  { label: 'Tokens Emitidos',      value: '180K+' },
]

const features = [
  {
    icon: Shield,
    title: 'Conformidade CVM 88',
    description: 'Operamos em total conformidade com a regulamentação da Comissão de Valores Mobiliários, protegendo seu investimento.',
  },
  {
    icon: Zap,
    title: 'Blockchain Stellar',
    description: 'Tokens emitidos e transferidos na rede Stellar — rápida, barata e sustentável. Transparência total on-chain.',
  },
  {
    icon: TrendingUp,
    title: 'Mercado Secundário',
    description: 'Liquidez quando você precisar. Negocie seus tokens com outros investidores dentro da plataforma.',
  },
  {
    icon: Lock,
    title: 'Custódia Segura',
    description: 'Wallet custodial integrada com chaves gerenciadas com segurança. Sem fricção, sem riscos de auto-custódia.',
  },
  {
    icon: Globe,
    title: 'Ativos Reais Tokenizados',
    description: 'De imóveis a aeronaves — investimentos em ativos reais, agora acessíveis em frações.',
  },
  {
    icon: CheckCircle,
    title: 'KYC/AML Integrado',
    description: 'Processo de verificação de identidade robusto e rápido, em conformidade com regulações anti-lavagem.',
  },
]

const steps = [
  { step: '01', title: 'Crie sua conta',    desc: 'Cadastro simples com KYC integrado em minutos.' },
  { step: '02', title: 'Escolha uma oferta', desc: 'Explore projetos auditados com informações completas.' },
  { step: '03', title: 'Invista',            desc: 'Reserve sua participação. Confirme e receba tokens.' },
  { step: '04', title: 'Acompanhe',          desc: 'Veja seu portfólio e negocie no mercado secundário.' },
]

export default async function HomePage() {
  const [liveOffers, reservationsAgg] = await Promise.all([
    prisma.offer.findMany({
      where:   { status: 'active' },
      include: { issuer: true },
      take:    3,
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
    <div>
      {/* CVM Warning */}
      <div className="bg-kate-yellow/10 border-b border-kate-yellow/20 py-2 px-4 text-center">
        <p className="text-xs text-kate-yellow/80">
          <strong className="text-kate-yellow">Aviso CVM:</strong> O investimento em valores mobiliários envolve riscos, incluindo a possibilidade de perda total do capital.
          <Link href="/riscos" className="underline ml-1 hover:text-kate-yellow">Saiba mais</Link>
        </p>
      </div>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-kate-dark-blue via-[#0d162a] to-kate-dark min-h-[90vh] flex items-center">
        {/* Glow effects */}
        <div className="absolute top-1/4 -right-32 w-[600px] h-[600px] rounded-full bg-kate-yellow/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-kate-yellow/10 border border-kate-yellow/30 rounded-full px-4 py-1.5 mb-8">
              <div className="w-2 h-2 rounded-full bg-kate-yellow animate-pulse" />
              <span className="text-kate-yellow text-xs font-semibold tracking-wide uppercase">Plataforma 100% Regulamentada · CVM 88</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              Invista no Futuro com{' '}
              <span className="text-kate-yellow">Tokens</span> na{' '}
              <span className="relative">
                Stellar
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-kate-yellow/50 rounded" />
              </span>
            </h1>

            <p className="text-lg text-white/60 leading-relaxed mb-10 max-w-2xl">
              A Kate é a primeira plataforma brasileira de Equity Crowdfunding integrada à blockchain Stellar.
              Tokenize seus investimentos, gerencie seu portfólio e participe do mercado secundário com segurança total.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/offers"
                className="flex items-center gap-2 bg-kate-orange text-kate-navy font-bold px-6 py-3.5 rounded-xl hover:-translate-y-0.5 hover:shadow-xl hover:shadow-kate-yellow/30 transition-all">
                Ver Oportunidades <ArrowRight size={18} />
              </Link>
              <Link href="/about"
                className="flex items-center gap-2 border border-white/20 text-white font-medium px-6 py-3.5 rounded-xl hover:bg-white/5 transition-all">
                Como Funciona
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────── */}
      <section className="bg-kate-dark-blue/60 border-y border-white/10 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl md:text-3xl font-extrabold text-kate-yellow">{s.value}</div>
                <div className="text-sm text-white/50 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Offers ──────────────────────────────────── */}
      {liveOffers.length > 0 && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-kate-yellow text-sm font-semibold uppercase tracking-wider mb-2">Em Captação</p>
              <h2 className="text-3xl font-bold text-white">Oportunidades Abertas</h2>
            </div>
            <Link href="/offers" className="hidden sm:flex items-center gap-1 text-sm text-white/50 hover:text-kate-yellow transition-colors">
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveOffers.map(offer => {
              // ⚡ Bolt: Offloaded to DB aggregate query to prevent loading all reservations into memory
              const raised = aggMap.get(offer.id) ?? 0
              const progress = offer.max_target ? Math.min((raised / offer.max_target) * 100, 100) : 0

              return (
                <div key={offer.id} className="group bg-kate-dark-blue border border-white/10 rounded-2xl overflow-hidden hover:border-kate-yellow/30 hover:-translate-y-1 hover:shadow-xl hover:shadow-kate-yellow/10 transition-all">
                  {/* Header */}
                  <div className="h-36 bg-gradient-to-br from-kate-dark-blue to-[#1a2a4a] flex items-center justify-center p-6 relative">
                    <div className="text-4xl font-black text-kate-yellow/20 select-none absolute inset-0 flex items-center justify-center">
                      {(offer.issuer.trade_name || offer.issuer.legal_name).substring(0, 2).toUpperCase()}
                    </div>
                    <span className="relative z-10 bg-kate-yellow/20 text-kate-yellow text-xs font-bold px-3 py-1 rounded-full uppercase">
                      {offer.security_type === 'equity' ? 'Equity' : 'Dívida'}
                    </span>
                  </div>

                  <div className="p-5">
                    <h3 className="font-bold text-white text-lg leading-tight">
                      {offer.issuer.trade_name || offer.issuer.legal_name}
                    </h3>
                    <p className="text-xs text-white/40 mt-0.5 mb-4">{offer.issuer.sector}</p>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-white/40 mb-1.5">
                        <span>Captado: R$ {raised.toLocaleString('pt-BR')}</span>
                        <span>{progress.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-kate-yellow rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-white/40 mb-5">
                      <span>Mínimo: <strong className="text-white">R$ {(offer.min_investment ?? 0).toLocaleString('pt-BR')}</strong></span>
                      <span>Meta: <strong className="text-white">R$ {(offer.max_target ?? 0).toLocaleString('pt-BR')}</strong></span>
                    </div>

                    <Link href={`/offers/${offer.id}`}
                      className="block w-full text-center bg-white/5 hover:bg-kate-yellow/10 hover:text-kate-yellow border border-white/10 hover:border-kate-yellow/30 text-white/80 font-medium py-2.5 rounded-xl text-sm transition-all">
                      Ver Detalhes
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Features ─────────────────────────────────────── */}
      <section className="py-20 bg-kate-dark-blue/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-kate-yellow text-sm font-semibold uppercase tracking-wider mb-3">Por que Kate?</p>
            <h2 className="text-3xl font-bold text-white">Tecnologia e Segurança em Cada Etapa</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="bg-kate-dark-blue/60 border border-white/8 rounded-2xl p-6 hover:border-kate-yellow/20 transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-kate-yellow/10 flex items-center justify-center mb-4 group-hover:bg-kate-yellow/20 transition-colors">
                  <f.icon size={22} className="text-kate-yellow" />
                </div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-kate-yellow text-sm font-semibold uppercase tracking-wider mb-3">Simples assim</p>
          <h2 className="text-3xl font-bold text-white">Como Funciona</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.step} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-kate-yellow/20 z-0" />
              )}
              <div className="relative z-10 bg-kate-dark-blue border border-white/10 rounded-2xl p-6">
                <div className="text-kate-yellow/30 font-black text-4xl mb-4 leading-none">{s.step}</div>
                <h3 className="font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-white/50">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-kate-dark-blue to-kate-dark">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-3xl font-extrabold text-white mb-4">
            Pronto para investir com <span className="text-kate-yellow">inteligência</span>?
          </h2>
          <p className="text-white/50 mb-8">
            Crie sua conta gratuitamente, complete o KYC e comece a investir em minutos.
          </p>
          <Link href="/onboarding"
            className="inline-flex items-center gap-2 bg-kate-orange text-kate-navy font-bold px-8 py-4 rounded-xl text-lg hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-kate-yellow/30 transition-all">
            Criar Conta Gratuita <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  )
}
