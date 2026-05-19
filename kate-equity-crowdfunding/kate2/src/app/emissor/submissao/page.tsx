'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import {
  Building2, Briefcase, TrendingUp, Target, Upload, Send,
  ChevronLeft, ChevronRight, Check, Loader2, CheckCircle2,
  AlertCircle, DollarSign, Calendar, Percent, Save,
} from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Perfil do Emissor',  icon: Building2 },
  { id: 2, title: 'Sobre o Negócio',    icon: Briefcase },
  { id: 3, title: 'Tração e Números',   icon: TrendingUp },
  { id: 4, title: 'Proposta de Oferta', icon: Target },
  { id: 5, title: 'Documentos',         icon: Upload },
  { id: 6, title: 'Revisão e Envio',    icon: Send },
];

type Form = {
  // Step 1
  issuer_id: string;
  cnpj: string;
  legal_name: string;
  address: string;
  legal_representative: string;
  // Step 2
  short_description: string;
  full_description: string;
  problem_solution: string;
  revenue_model: string;
  target_market: string;
  competitive_advantage: string;
  // Step 3
  current_revenue: string;
  growth_info: string;
  key_metrics: string;
  team_info: string;
  // Step 4
  offer_title: string;
  min_target: string;
  max_target: string;
  end_date: string;
  unit_price: string;
  min_investment: string;
  equity_offered: string;
  use_of_funds: string;
  // Step 5
  pitch_deck_url: string;
  social_contract_url: string;
  cap_table_url: string;
  financial_report_url: string;
  // Meta
  offer_id: string;
};

const EMPTY: Form = {
  issuer_id: '', cnpj: '', legal_name: '', address: '', legal_representative: '',
  short_description: '', full_description: '', problem_solution: '',
  revenue_model: '', target_market: '', competitive_advantage: '',
  current_revenue: '', growth_info: '', key_metrics: '', team_info: '',
  offer_title: '', min_target: '', max_target: '', end_date: '',
  unit_price: '', min_investment: '', equity_offered: '', use_of_funds: '',
  pitch_deck_url: '', social_contract_url: '', cap_table_url: '', financial_report_url: '',
  offer_id: '',
};

export default function SubmissaoWizardPage() {
  const router  = useRouter();
  const [step, setStep]       = useState(1);
  const [form, setForm]       = useState<Form>(EMPTY);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [agreed, setAgreed]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (field: keyof Form, value: string) => {
    setForm(p => ({ ...p, [field]: value }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
  };

  // tRPC mutations
  const createIssuer    = trpc.issuers.create.useMutation();
  const updateIssuer    = trpc.issuers.update.useMutation();
  const createOffer     = trpc.issuers.createOffer.useMutation();
  const updateEssential = trpc.issuers.updateEssentialInfo.useMutation();
  const addDocument     = trpc.issuers.addDocument.useMutation();
  const submitReview    = trpc.issuers.submitForReview.useMutation({
    onSuccess: () => setSubmitted(true),
    onError:   (e) => setErrors({ submit: e.message }),
  });

  const progress = Math.round(
    (Object.values(form).filter(Boolean).length / Object.keys(form).length) * 100
  );

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.cnpj.replace(/\D/g,'').match(/^\d{14}$/)) e.cnpj = 'CNPJ inválido';
      if (!form.legal_name.trim()) e.legal_name = 'Obrigatório';
      if (!form.address.trim())   e.address = 'Obrigatório';
      if (!form.legal_representative.trim()) e.legal_representative = 'Obrigatório';
    }
    if (s === 2) {
      if (!form.short_description.trim()) e.short_description = 'Obrigatório';
      if (!form.full_description.trim())  e.full_description  = 'Obrigatório';
      if (!form.problem_solution.trim())  e.problem_solution  = 'Obrigatório';
    }
    if (s === 4) {
      if (!form.offer_title.trim()) e.offer_title = 'Obrigatório';
      if (!form.min_target)         e.min_target  = 'Obrigatório';
      if (!form.max_target)         e.max_target  = 'Obrigatório';
      if (!form.end_date)           e.end_date    = 'Obrigatório';
      if (!form.unit_price)         e.unit_price  = 'Obrigatório';
      if (!form.equity_offered.trim()) e.equity_offered = 'Obrigatório';
    }
    if (s === 5) {
      if (!form.pitch_deck_url.trim())      e.pitch_deck_url      = 'Obrigatório';
      if (!form.social_contract_url.trim()) e.social_contract_url = 'Obrigatório';
      if (!form.cap_table_url.trim())       e.cap_table_url       = 'Obrigatório';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveStep = async (s: number) => {
    if (s === 1) {
      const issuer = await createIssuer.mutateAsync({
        legal_name: form.legal_name,
        cnpj: form.cnpj.replace(/\D/g, ''),
        headquarters_address: form.address,
      });
      set('issuer_id', issuer.id);
    }
    if (s === 2 || s === 3) {
      if (form.offer_id) {
        await updateEssential.mutateAsync({
          offer_id:    form.offer_id,
          company_info: { legal_representative: form.legal_representative },
          business_plan: {
            short_description: form.short_description,
            full_description:  form.full_description,
            problem_solution:  form.problem_solution,
            revenue_model:     form.revenue_model,
            target_market:     form.target_market,
            competitive_advantage: form.competitive_advantage,
            current_revenue:   form.current_revenue,
            growth_info:       form.growth_info,
            key_metrics:       form.key_metrics,
            team_info:         form.team_info,
          },
        });
      }
    }
    if (s === 4 && form.issuer_id) {
      const offer = await createOffer.mutateAsync({
        issuer_id:      form.issuer_id,
        title:          form.offer_title,
        min_target:     Number(form.min_target),
        max_target:     Number(form.max_target),
        unit_price:     Number(form.unit_price),
        min_investment: Number(form.min_investment) || Number(form.unit_price),
        end_date:       form.end_date,
        equity_offered: form.equity_offered,
        use_of_funds:   form.use_of_funds,
      });
      set('offer_id', offer.id);
    }
    if (s === 5 && form.offer_id) {
      const docs = [
        { type: 'pitch_deck',       url: form.pitch_deck_url },
        { type: 'social_contract',  url: form.social_contract_url },
        { type: 'cap_table',        url: form.cap_table_url },
        { type: 'financial_report', url: form.financial_report_url },
      ].filter(d => d.url);
      // Optimize document submission to run in parallel
      await Promise.all(docs.map(d =>
        addDocument.mutateAsync({
          offer_id: form.offer_id, document_type: d.type,
          file_url: d.url, is_public: false,
        })
      ));
    }
  };

  const handleNext = async () => {
    if (!validate(step)) return;
    try {
      await saveStep(step);
      setStep(s => Math.min(s + 1, 6));
    } catch (e: any) {
      setErrors({ submit: e.message });
    }
  };

  const handleSubmit = async () => {
    if (!agreed) { setErrors({ terms: 'Aceite os termos para continuar' }); return; }
    if (!form.issuer_id) { setErrors({ submit: 'Complete as etapas anteriores' }); return; }
    await submitReview.mutateAsync({ issuer_id: form.issuer_id, offer_id: form.offer_id || undefined });
  };

  const isLoading = createIssuer.isPending || updateIssuer.isPending || createOffer.isPending ||
    updateEssential.isPending || addDocument.isPending || submitReview.isPending;

  if (submitted) {
    return (
      <div className="min-h-screen bg-kate-dark-blue flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-kate-yellow/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-kate-yellow" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Projeto enviado!</h1>
          <p className="text-white/60 mb-8">
            Nossa equipe analisará sua submissão e entrará em contato em até 7 dias úteis.
          </p>
          <Link href="/dashboard" className="px-6 py-3 bg-kate-orange text-kate-navy font-bold rounded-xl hover:opacity-90 transition-opacity">
            Ir para o dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kate-dark-blue py-10">
      <div className="max-w-3xl mx-auto px-4">

        {/* Header */}
        <div className="mb-8">
          <Link href="/captar" className="text-white/30 hover:text-white text-sm transition-colors">
            ← Voltar à pré-inscrição
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3">Submissão completa de projeto</h1>
          <p className="text-white/40 text-sm mt-1">
            {form.legal_name || 'Complete as etapas para enviar para análise'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-xs text-white/40 mb-2">
            <span>{progress}% completo</span>
            <span className="flex items-center gap-1">
              {isLoading && <><Loader2 size={11} className="animate-spin" /> Salvando...</>}
              {!isLoading && form.issuer_id && <><Check size={11} className="text-green-400" /> Salvo</>}
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-kate-yellow transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Step navigation */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-6">
          {STEPS.map((s, i) => {
            const done   = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center shrink-0">
                <button
                  onClick={() => step > s.id && setStep(s.id)}
                  disabled={step < s.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    active ? 'bg-kate-yellow/15 text-kate-yellow font-semibold border border-kate-yellow/30'
                    : done  ? 'text-green-400 hover:bg-green-400/10 cursor-pointer'
                    : 'text-white/30 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    active ? 'bg-kate-orange text-kate-navy'
                    : done  ? 'bg-green-400/20 text-green-400'
                    : 'bg-white/10 text-white/30'
                  }`}>
                    {done ? <Check size={12} /> : s.id}
                  </div>
                  <span className="hidden sm:inline">{s.title}</span>
                </button>
                {i < STEPS.length - 1 && <ChevronRight size={14} className="text-white/20 mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="space-y-5">
              <SectionHeader title="Perfil do Emissor" desc="Dados jurídicos da empresa responsável pela captação" />
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="CNPJ *" value={form.cnpj} onChange={v => set('cnpj', v)} placeholder="00.000.000/0001-00" error={errors.cnpj} />
                <Field label="Razão social *" value={form.legal_name} onChange={v => set('legal_name', v)} placeholder="Empresa LTDA" error={errors.legal_name} />
              </div>
              <Field label="Endereço completo *" value={form.address} onChange={v => set('address', v)} placeholder="Rua, número, bairro, cidade/UF, CEP" error={errors.address} />
              <Field label="Representante legal *" value={form.legal_representative} onChange={v => set('legal_representative', v)} placeholder="Nome do representante legal" error={errors.legal_representative} />
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="space-y-5">
              <SectionHeader title="Sobre o Negócio" desc="Conte sobre sua empresa, o que ela faz e como" />
              <Field label="Descrição curta *" value={form.short_description} onChange={v => set('short_description', v)} placeholder="Resumo objetivo em 1-2 frases" error={errors.short_description} maxLength={200} />
              <TextArea label="História completa *" value={form.full_description} onChange={v => set('full_description', v)} placeholder="Conte a história, trajetória e visão da empresa..." error={errors.full_description} rows={5} />
              <TextArea label="Problema / Solução *" value={form.problem_solution} onChange={v => set('problem_solution', v)} placeholder="Qual problema vocês resolvem e como?" error={errors.problem_solution} rows={4} />
              <div className="grid md:grid-cols-2 gap-4">
                <TextArea label="Modelo de receita" value={form.revenue_model} onChange={v => set('revenue_model', v)} placeholder="Como a empresa ganha dinheiro?" rows={3} />
                <TextArea label="Mercado-alvo" value={form.target_market} onChange={v => set('target_market', v)} placeholder="Quem são seus clientes?" rows={3} />
              </div>
              <TextArea label="Diferencial competitivo" value={form.competitive_advantage} onChange={v => set('competitive_advantage', v)} placeholder="O que diferencia vocês da concorrência?" rows={3} />
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div className="space-y-5">
              <SectionHeader title="Tração e Números" desc="Métricas e time (campos opcionais mas importantes)" />
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Receita atual" value={form.current_revenue} onChange={v => set('current_revenue', v)} placeholder="Ex: R$ 50.000/mês" />
                <Field label="Crescimento" value={form.growth_info} onChange={v => set('growth_info', v)} placeholder="Ex: 15% ao mês" />
              </div>
              <TextArea label="Principais métricas" value={form.key_metrics} onChange={v => set('key_metrics', v)} placeholder="Clientes ativos, NPS, ticket médio..." rows={4} />
              <TextArea label="Time (pessoas-chave)" value={form.team_info} onChange={v => set('team_info', v)} placeholder="Descreva os fundadores e lideranças..." rows={4} />
              <div className="p-4 bg-kate-yellow/5 border border-kate-yellow/20 rounded-xl flex items-start gap-3">
                <AlertCircle size={16} className="text-kate-yellow shrink-0 mt-0.5" />
                <p className="text-xs text-white/60">Quanto mais dados, maior a chance de aprovação e mais atrativo para investidores.</p>
              </div>
            </div>
          )}

          {/* ── STEP 4 ── */}
          {step === 4 && (
            <div className="space-y-5">
              <SectionHeader title="Proposta de Oferta" desc="Defina os termos da sua captação" />
              <Field label="Título da oferta *" value={form.offer_title} onChange={v => set('offer_title', v)} placeholder="Ex: Rodada Série A — TechCo" error={errors.offer_title} />
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Meta mínima (R$) *" type="number" value={form.min_target} onChange={v => set('min_target', v)} placeholder="500000" error={errors.min_target} />
                <Field label="Meta máxima (R$) *" type="number" value={form.max_target} onChange={v => set('max_target', v)} placeholder="2000000" error={errors.max_target} />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Preço unitário (R$) *" type="number" value={form.unit_price} onChange={v => set('unit_price', v)} placeholder="100" error={errors.unit_price} />
                <Field label="Investimento mínimo (R$)" type="number" value={form.min_investment} onChange={v => set('min_investment', v)} placeholder="500" />
                <Field label="Data final *" type="date" value={form.end_date} onChange={v => set('end_date', v)} error={errors.end_date} />
              </div>
              <Field label="Equity oferecida *" value={form.equity_offered} onChange={v => set('equity_offered', v)} placeholder="Ex: 10% a 20%" error={errors.equity_offered} />
              <TextArea label="Uso dos recursos" value={form.use_of_funds} onChange={v => set('use_of_funds', v)} placeholder="Descreva como os recursos captados serão utilizados..." rows={4} />
            </div>
          )}

          {/* ── STEP 5 ── */}
          {step === 5 && (
            <div className="space-y-5">
              <SectionHeader title="Documentos" desc="Informe as URLs dos documentos. Use Google Drive, Dropbox ou similar com link de visualização." />
              <Field label="Pitch Deck *" value={form.pitch_deck_url} onChange={v => set('pitch_deck_url', v)} placeholder="https://drive.google.com/..." error={errors.pitch_deck_url} />
              <Field label="Contrato Social / Estatuto *" value={form.social_contract_url} onChange={v => set('social_contract_url', v)} placeholder="https://drive.google.com/..." error={errors.social_contract_url} />
              <Field label="Cap Table *" value={form.cap_table_url} onChange={v => set('cap_table_url', v)} placeholder="https://drive.google.com/..." error={errors.cap_table_url} />
              <Field label="DRE / Relatório Financeiro (opcional)" value={form.financial_report_url} onChange={v => set('financial_report_url', v)} placeholder="https://drive.google.com/..." />
            </div>
          )}

          {/* ── STEP 6 ── */}
          {step === 6 && (
            <div className="space-y-6">
              <SectionHeader title="Revisão e Envio" desc="Confirme as informações antes de enviar para análise" />
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                {[
                  ['Empresa',         form.legal_name],
                  ['CNPJ',            form.cnpj],
                  ['Representante',   form.legal_representative],
                  ['Título da oferta',form.offer_title],
                  ['Meta mínima',     form.min_target ? `R$ ${Number(form.min_target).toLocaleString('pt-BR')}` : '—'],
                  ['Meta máxima',     form.max_target ? `R$ ${Number(form.max_target).toLocaleString('pt-BR')}` : '—'],
                  ['Equity ofertada', form.equity_offered],
                  ['Prazo',           form.end_date],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-white/30 mb-1">{label}</p>
                    <p className="text-white font-medium">{value || '—'}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-amber-400/5 border border-amber-400/20 rounded-xl">
                <p className="text-xs text-white/50 mb-4">
                  Ao enviar, declaro que as informações prestadas são verdadeiras e completas, e autorizo a Kate Equity a analisar e, se aprovada, publicar a oferta conforme a Resolução CVM nº 88/2022.
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1 accent-kate-yellow" />
                  <span className="text-sm text-white/70">Li e aceito os Termos de Uso e autorizo o processamento das informações acima.</span>
                </label>
                {errors.terms && <p className="mt-2 text-xs text-red-400">{errors.terms}</p>}
              </div>
              {errors.submit && (
                <div className="p-4 bg-red-500/10 border border-red-400/30 rounded-xl text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle size={16} /> {errors.submit}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <button
              onClick={() => setStep(s => Math.max(s - 1, 1))}
              disabled={step === 1}
              className="flex items-center gap-2 px-4 py-2 text-white/50 hover:text-white disabled:opacity-30 transition-colors rounded-lg"
            >
              <ChevronLeft size={18} /> Anterior
            </button>
            {step < 6 ? (
              <button
                onClick={handleNext}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-3 bg-kate-orange text-kate-navy font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                Próximo <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!agreed || submitReview.isPending}
                className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitReview.isPending
                  ? <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                  : <><Send size={16} /> Enviar para análise</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="text-sm text-white/40">{desc}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', error, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; error?: string; maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full px-4 py-3 rounded-xl border bg-white/5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-kate-yellow/40 transition-colors ${
          error ? 'border-red-400/60' : 'border-white/10'
        }`}
      />
      {maxLength && <p className="mt-1 text-xs text-white/30">{value.length}/{maxLength}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, error, rows = 4 }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; error?: string; rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-2">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-4 py-3 rounded-xl border bg-white/5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-kate-yellow/40 transition-colors resize-none ${
          error ? 'border-red-400/60' : 'border-white/10'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
