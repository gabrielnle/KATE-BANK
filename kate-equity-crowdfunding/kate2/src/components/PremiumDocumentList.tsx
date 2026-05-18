'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import {
  FileText, Lock, Unlock, Loader2, CheckCircle2,
  ExternalLink, X, Zap, ShieldCheck
} from 'lucide-react'

interface OfferDoc {
  id: string
  document_type: string | null
  file_url: string | null
  is_public: boolean | null
  isPremium: boolean
  priceXLM: number | null
}

interface Props {
  documents: OfferDoc[]
  offerId: string
}

export function PremiumDocumentList({ documents, offerId }: Props) {
  const [dialogDoc, setDialogDoc] = useState<OfferDoc | null>(null)
  const [unlockingId, setUnlockingId] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{ txHash: string; fileUrl: string } | null>(null)

  // Fetch which docs the user has already unlocked
  const { data: accesses, refetch: refetchAccesses } = trpc.offers.getDocumentAccesses.useQuery(
    { offerId },
    { retry: false } // fail silently if not logged in
  )

  const unlockMutation = trpc.offers.unlockPremiumDocument.useMutation({
    onSuccess: (data) => {
      setUnlockingId(null)
      setSuccessInfo({ txHash: data.txHash ?? '', fileUrl: data.fileUrl ?? '' })
      refetchAccesses()
    },
    onError: (err) => {
      setUnlockingId(null)
      alert(err.message)
    },
  })

  const handleUnlockConfirm = (doc: OfferDoc) => {
    setUnlockingId(doc.id)
    setDialogDoc(null)
    unlockMutation.mutate({ documentId: doc.id })
  }

  const handleDocClick = (doc: OfferDoc) => {
    const isUnlocked = accesses?.[doc.id] !== undefined

    if (!doc.isPremium || isUnlocked) {
      // Open the document directly
      const url = doc.file_url || `/documents/${doc.id}.pdf`
      window.open(url, '_blank')
      return
    }

    // Show payment dialog
    setSuccessInfo(null)
    setDialogDoc(doc)
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-6">
        <FileText size={28} className="mx-auto text-white/20 mb-2" />
        <p className="text-white/40 text-sm">Nenhum documento disponível.</p>
      </div>
    )
  }

  const docTypeLabel: Record<string, string> = {
    prospectus: 'Prospecto',
    financial_statements: 'Demonstrações Financeiras',
    business_plan: 'Plano de Negócios',
    valuation: 'Valuation Report',
    legal: 'Documentos Legais',
    cap_table: 'Cap Table',
    pitch_deck: 'Pitch Deck',
    due_diligence: 'Due Diligence',
    shareholder_agreement: 'Acordo de Acionistas',
  }

  return (
    <>
      <div className="space-y-2">
        {documents.map((doc) => {
          const isUnlocked = accesses?.[doc.id] !== undefined
          const isUnlocking = unlockingId === doc.id
          const label = docTypeLabel[doc.document_type ?? ''] ?? doc.document_type ?? 'Documento'

          return (
            <button
              key={doc.id}
              onClick={() => handleDocClick(doc)}
              disabled={isUnlocking}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-left group"
            >
              {/* Icon */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                doc.isPremium && !isUnlocked
                  ? 'bg-amber-500/10'
                  : 'bg-white/5'
              }`}>
                {isUnlocking ? (
                  <Loader2 size={16} className="text-kate-yellow animate-spin" />
                ) : doc.isPremium && !isUnlocked ? (
                  <Lock size={16} className="text-amber-400" />
                ) : doc.isPremium && isUnlocked ? (
                  <Unlock size={16} className="text-green-400" />
                ) : (
                  <FileText size={16} className="text-white/40" />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  doc.isPremium && !isUnlocked
                    ? 'text-white/60'
                    : 'text-white group-hover:text-kate-yellow transition-colors'
                }`}>
                  {label}
                </p>
                {isUnlocking && (
                  <p className="text-kate-yellow text-xs animate-pulse mt-0.5">
                    Assinando na blockchain...
                  </p>
                )}
              </div>

              {/* Badge */}
              {doc.isPremium && !isUnlocked && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 whitespace-nowrap">
                  {doc.priceXLM ?? 1} XLM
                </span>
              )}
              {doc.isPremium && isUnlocked && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 whitespace-nowrap">
                  ✓ Desbloqueado
                </span>
              )}
              {!doc.isPremium && (
                <ExternalLink size={12} className="text-white/20 group-hover:text-white/40 shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Payment Confirmation Dialog ── */}
      {dialogDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#14213C] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            {/* Close */}
            <button
              onClick={() => setDialogDoc(null)}
              aria-label="Fechar"
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X size={14} className="text-white/40" />
            </button>

            {!successInfo ? (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Zap size={24} className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">Data Room Premium</h3>
                    <p className="text-white/40 text-xs">Micropagamento x402 via Web3</p>
                  </div>
                </div>

                {/* Explanation */}
                <div className="bg-white/5 border border-white/[0.06] rounded-xl p-4 mb-5">
                  <p className="text-white/70 text-sm leading-relaxed">
                    Este documento corporativo exige um <strong className="text-kate-yellow">micropagamento anti-spam 
                    de {dialogDoc.priceXLM ?? 1} XLM</strong> via Web3, registrado diretamente na blockchain Stellar.
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Documento</span>
                    <span className="text-white font-medium">
                      {docTypeLabel[dialogDoc.document_type ?? ''] ?? dialogDoc.document_type}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Custo</span>
                    <span className="text-kate-yellow font-bold">{dialogDoc.priceXLM ?? 1} XLM</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Rede</span>
                    <span className="text-white/70">Stellar Testnet</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Registro</span>
                    <span className="text-green-400 text-xs flex items-center gap-1">
                      <ShieldCheck size={12} /> On-chain imutável
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setDialogDoc(null)}
                    className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 font-medium hover:bg-white/10 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleUnlockConfirm(dialogDoc)}
                    className="flex-1 py-3 rounded-xl bg-kate-orange text-kate-navy font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <Zap size={16} />
                    Pagar {dialogDoc.priceXLM ?? 1} XLM
                  </button>
                </div>
              </>
            ) : (
              /* Success State */
              <div className="text-center py-2">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-green-400" />
                </div>
                <h3 className="text-white font-bold text-lg mb-1">Documento Desbloqueado!</h3>
                <p className="text-white/50 text-sm mb-5">
                  Pagamento de <span className="text-kate-yellow font-bold">{dialogDoc.priceXLM ?? 1} XLM</span> confirmado na blockchain
                </p>

                {successInfo.txHash && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${successInfo.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-kate-yellow hover:underline mb-5"
                  >
                    Ver transação na Explorer <ExternalLink size={10} />
                  </a>
                )}

                <button
                  onClick={() => {
                    window.open(successInfo.fileUrl, '_blank')
                    setDialogDoc(null)
                    setSuccessInfo(null)
                  }}
                  className="w-full py-3 rounded-xl bg-kate-orange text-kate-navy font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={16} />
                  Abrir Documento
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
