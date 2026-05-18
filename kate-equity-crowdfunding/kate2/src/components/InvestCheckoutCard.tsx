'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import {
  Loader2, CheckCircle2, ExternalLink, ArrowRightLeft,
  Coins, DollarSign, Zap, ShieldCheck, AlertTriangle
} from 'lucide-react'

type Currency = 'BRZ' | 'USDC'

interface Props {
  offerId: string
  unitPrice: number
  minInvestment: number
  isActive: boolean
  statusLabel: string
}

export function InvestCheckoutCard({
  offerId,
  unitPrice,
  minInvestment,
  isActive,
  statusLabel,
}: Props) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('BRZ')
  const [stage, setStage] = useState<'input' | 'confirm' | 'processing' | 'success'>('input')
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState<{
    txHash: string
    route: string
    tokenQuantity: number
    reservationId: string
  } | null>(null)

  const investMutation = trpc.offers.processInvestment.useMutation({
    onSuccess: (data) => {
      setResult({
        txHash: data.txHash,
        route: data.route,
        tokenQuantity: data.tokenQuantity,
        reservationId: data.reservationId,
      })
      setStage('success')
    },
    onError: (err) => {
      setErrorMsg(err.message)
      setStage('confirm')
    },
  })

  const numericAmount = parseFloat(amount) || 0
  const isValidAmount = numericAmount >= minInvestment
  const tokenQuantity = unitPrice > 0 ? numericAmount / unitPrice : 0

  const handleInvest = () => {
    setErrorMsg('')
    setStage('processing')
    investMutation.mutate({
      offerId,
      amount: numericAmount,
      currency,
    })
  }

  if (!isActive) {
    return (
      <div className="w-full text-center bg-white/5 text-white/30 font-bold py-3.5 rounded-xl border border-white/10 cursor-not-allowed">
        Oferta {statusLabel}
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── INPUT STAGE ── */}
      {stage === 'input' && (
        <>
          {/* Currency Toggle */}
          <div>
            <label className="text-white/40 text-xs block mb-2">Forma de pagamento</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCurrency('BRZ')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  currency === 'BRZ'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                }`}
              >
                <Coins size={14} />
                BRZ
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USDC')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  currency === 'USDC'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                }`}
              >
                <DollarSign size={14} />
                USDC
              </button>
            </div>
            {currency === 'USDC' && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-blue-400/70">
                <ArrowRightLeft size={10} />
                Conversão automática via AMM da Stellar (SDEX)
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label htmlFor="investment-amount" className="text-white/40 text-xs block mb-2">
              Valor ({currency === 'BRZ' ? 'R$' : 'USD'})
            </label>
            <input
              id="investment-amount"
              type="number"
              min={minInvestment}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Mín. ${minInvestment.toLocaleString('pt-BR')}`}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold outline-none focus:border-kate-yellow/40 transition-colors placeholder:text-white/20"
            />
            {amount && numericAmount > 0 && (
              <p className="text-white/30 text-xs mt-1.5">
                ≈ <span className="text-kate-yellow font-semibold">{tokenQuantity.toFixed(2)}</span> tokens
                ({unitPrice > 0 ? `R$ ${unitPrice.toLocaleString('pt-BR')}/token` : ''})
              </p>
            )}
          </div>

          {/* Quick amounts */}
          <div className="grid grid-cols-3 gap-2">
            {[minInvestment, minInvestment * 2, minInvestment * 5].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v.toString())}
                className="py-1.5 rounded-lg bg-white/5 border border-white/[0.06] text-white/50 text-xs font-medium hover:bg-kate-yellow/10 hover:text-kate-yellow transition-all"
              >
                {currency === 'BRZ' ? 'R$ ' : '$ '}{v.toLocaleString('pt-BR')}
              </button>
            ))}
          </div>

          {/* CTA */}
          <button
            type="button"
            disabled={!isValidAmount}
            onClick={() => { setErrorMsg(''); setStage('confirm') }}
            className={`w-full py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              isValidAmount
                ? 'bg-kate-orange text-kate-navy hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-kate-yellow/30'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            Investir Agora
          </button>
        </>
      )}

      {/* ── CONFIRM STAGE ── */}
      {stage === 'confirm' && (
        <div className="animate-fade-in">
          <div className="bg-white/5 border border-white/[0.06] rounded-xl p-4 space-y-3 mb-4">
            <h4 className="text-white font-bold text-sm flex items-center gap-2">
              <ShieldCheck size={14} className="text-kate-yellow" />
              Confirmar Investimento
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Valor</span>
                <span className="text-white font-bold">
                  {currency === 'BRZ' ? 'R$ ' : '$ '}{numericAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Moeda</span>
                <span className={`font-semibold ${currency === 'BRZ' ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {currency}
                </span>
              </div>
              {currency === 'USDC' && (
                <div className="flex justify-between">
                  <span className="text-white/40">Rota</span>
                  <span className="text-blue-400 text-xs flex items-center gap-1">
                    <ArrowRightLeft size={10} /> USDC → SDEX → BRZ
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-white/40">Tokens</span>
                <span className="text-kate-yellow font-bold">
                  ≈ {tokenQuantity.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Rede</span>
                <span className="text-white/60">Stellar Testnet</span>
              </div>
            </div>
          </div>

          {/* CVM 88 warning */}
          <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg p-3 mb-4">
            <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-200/60 text-[11px] leading-relaxed">
              Conforme CVM 88, você tem <strong className="text-amber-400">5 dias</strong> para exercer
              o direito de desistência após a confirmação.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle size={14} />
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStage('input')}
              className="py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 font-medium hover:bg-white/10 transition-colors"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleInvest}
              className="py-3 rounded-xl bg-kate-orange text-kate-navy font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <Zap size={14} />
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* ── PROCESSING STAGE ── */}
      {stage === 'processing' && (
        <div className="animate-fade-in text-center py-4">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-kate-yellow/10 flex items-center justify-center animate-pulse">
            <Loader2 size={28} className="text-kate-yellow animate-spin" />
          </div>
          <p className="text-white font-bold mb-1">Processando investimento...</p>
          <p className="text-white/40 text-xs mb-4">
            {currency === 'USDC'
              ? 'Executando swap USDC → BRZ via SDEX...'
              : 'Transferindo BRZ para o Escrow...'}
          </p>
          <div className="space-y-1.5">
            {[
              'Verificando saldo',
              currency === 'USDC' ? 'Buscando rota no SDEX (AMM)' : 'Preparando transação',
              'Assinando na blockchain',
              'Enviando para o Escrow',
            ].map((step, i) => (
              <div key={step} className="flex items-center justify-center gap-2 text-xs text-white/25">
                <div
                  className="w-1.5 h-1.5 rounded-full bg-kate-yellow animate-pulse"
                  style={{ animationDelay: `${i * 300}ms` }}
                />
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SUCCESS STAGE ── */}
      {stage === 'success' && result && (
        <div className="animate-fade-in text-center py-2">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h3 className="text-white font-bold text-lg mb-1">Investimento Confirmado! 🎉</h3>
          <p className="text-white/50 text-sm mb-4">
            <span className="text-kate-yellow font-bold">{result.tokenQuantity.toFixed(2)} tokens</span> reservados
          </p>

          {/* Details */}
          <div className="bg-white/5 rounded-xl p-3 text-left space-y-2 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Rota</span>
              <span className="text-white/70 font-mono">{result.route}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Status</span>
              <span className="text-amber-400 font-semibold">Pending Escrow</span>
            </div>
            <div className="text-xs">
              <span className="text-white/40 block mb-1">Tx Hash</span>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-kate-yellow text-[10px] font-mono hover:underline break-all flex items-center gap-1"
              >
                {result.txHash.substring(0, 24)}... <ExternalLink size={9} />
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 rounded-xl bg-kate-orange text-kate-navy font-bold hover:brightness-110 transition-all"
          >
            Ir para o Dashboard
          </button>
        </div>
      )}

      {/* Stellar badge */}
      {stage === 'input' && (
        <div className="flex items-center justify-center gap-2 text-xs text-white/30 pt-1">
          <ShieldCheck size={12} className="text-green-400" />
          Transação registrada na Stellar Network
        </div>
      )}
    </div>
  )
}
