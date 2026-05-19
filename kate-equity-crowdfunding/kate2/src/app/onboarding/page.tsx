'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { KateLogo } from '@/components/KateLogo';
import { isValidCPF, formatCPF, type CPFValidationResult } from '@/lib/cpf';
import { signUpUser } from '@/app/actions/auth';

type Step = 1 | 2 | 3;

const STEPS = [
  { id: 1, label: 'Dados Pessoais' },
  { id: 2, label: 'Perfil de Risco' },
  { id: 3, label: 'Declaração' },
];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');

  // CPF validation state
  const [cpfStatus, setCpfStatus] = useState<CPFValidationResult | null>(null);
  const [cpfChecking, setCpfChecking] = useState(false);

  // Step 2
  const [annualIncome, setAnnualIncome] = useState('');
  const [financialInvestments, setFinancialInvestments] = useState('');
  const [investorType, setInvestorType] = useState('retail');

  // Step 3
  const [agreed, setAgreed] = useState(false);
  const [agreedRisk, setAgreedRisk] = useState(false);

  const hasSequentialNumbers = (pass: string) => {
    for (let i = 0; i < pass.length - 2; i++) {
      const c1 = pass.charCodeAt(i);
      const c2 = pass.charCodeAt(i + 1);
      const c3 = pass.charCodeAt(i + 2);

      if (c1 < 48 || c1 > 57) continue;
      if (c2 < 48 || c2 > 57) continue;
      if (c3 < 48 || c3 > 57) continue;

      if (c1 + 1 === c2 && c2 + 1 === c3) return true;
      if (c1 - 1 === c2 && c2 - 1 === c3) return true;
    }
    return false;
  };

  const isPasswordValid = password.length >= 12 && password.length <= 15 && 
                          /[A-Z]/.test(password) && /[a-z]/.test(password) && 
                          /[0-9]/.test(password) && !hasSequentialNumbers(password) && 
                          (password.match(/[^A-Za-z0-9]/g) || []).length >= 2 && 
                          password === confirmPassword;

  const handlePhoneChange = (val: string) => {
    let v = val.replace(/\D/g, '');
    if (v.startsWith('55') && v.length > 2) {
      v = v.substring(2);
    } else if (v === '55' || v.length === 0) {
      setPhone('');
      return;
    }
    if (v.length > 11) v = v.substring(0, 11);
    
    let res = '+55 ';
    if (v.length > 0) res += '(' + v.substring(0, 2);
    if (v.length > 2) res += ') ' + v.substring(2, 7);
    if (v.length > 7) res += '-' + v.substring(7);
    
    setPhone(res);
  };

  // ------- CPF handlers -------
  const handleCpfChange = (raw: string) => {
    const formatted = formatCPF(raw);
    setCpf(formatted);
    setCpfStatus(null); // limpa resultado ao editar

    // Feedback imediato de formato inválido (sem chamada API)
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 11 && !isValidCPF(digits)) {
      setCpfStatus({ status: 'invalid_digits', message: 'CPF inválido. Dígitos verificadores não conferem.' });
    }
  };

  const handleCpfValidate = useCallback(async () => {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) {
      setCpfStatus({ status: 'invalid_format', message: 'CPF incompleto.' });
      return;
    }
    if (!isValidCPF(digits)) {
      setCpfStatus({ status: 'invalid_digits', message: 'CPF inválido. Dígitos verificadores não conferem.' });
      return;
    }

    setCpfChecking(true);
    try {
      const res = await fetch('/api/validate-cpf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: digits, birthDate: birthDate || undefined }),
      });
      const data: CPFValidationResult = await res.json();
      setCpfStatus(data);
    } catch {
      setCpfStatus({ status: 'error', message: 'Erro ao contatar o servidor de validação.' });
    } finally {
      setCpfChecking(false);
    }
  }, [cpf, birthDate]);

  // Bloqueia avançar se CPF não foi validado com sucesso
  const cpfIsOk = cpfStatus?.status === 'valid';
  const step1CanAdvance = email.trim().length > 0 && isPasswordValid && fullName.trim().length > 0 && cpfIsOk && phone.length >= 18;

  const handleFinish = async () => {
    setLoading(true);
    setErrorMsg('');
    
    const res = await signUpUser({
      email,
      password,
      fullName,
      cpf: cpf.replace(/\D/g, ''),
      phone,
      birthDate,
      investorType,
      annualIncome,
      financialInvestments
    });
    
    setLoading(false);
    
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }
    
    setDone(true);
  };

  if (done) {
    return (
      <div style={outerStyle}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🎉</div>
          <h1 className="text-h2" style={{ color: 'var(--kate-yellow)', marginBottom: '1rem' }}>
            Cadastro Concluído!
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', marginBottom: '2rem', maxWidth: '400px' }}>
            Seu perfil de investidor foi criado com sucesso. Agora você pode explorar as oportunidades disponíveis na Kate Equity.
          </p>
          <Link href="/offers" className="btn-primary" style={{ padding: '1rem 2rem', fontSize: '1rem' }}>
            Ver Oportunidades
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={outerStyle}>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <KateLogo width={140} mode="white" />
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step >= s.id ? 'var(--kate-yellow)' : 'rgba(255,255,255,0.1)',
                color: step >= s.id ? 'var(--kate-dark-blue)' : 'rgba(255,255,255,0.4)',
                fontWeight: 700, fontSize: '0.875rem', transition: 'all 0.3s',
              }}>
                {step > s.id ? '✓' : s.id}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: '60px', height: '2px',
                  background: step > s.id ? 'var(--kate-yellow)' : 'rgba(255,255,255,0.1)',
                  transition: 'all 0.3s',
                }} />
              )}
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: '2rem' }}>
          {STEPS.find(s => s.id === step)?.label}
        </p>

        {/* Card */}
        <div style={cardStyle}>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 className="text-h3" style={{ color: 'white' }}>Seus dados pessoais</h2>

              <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
              <Field label="Senha" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
              <Field label="Confirmar Senha" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" />
              
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', fontSize: '0.8125rem' }}>
                <p style={{ color: 'white', marginBottom: '0.5rem', fontWeight: 600 }}>A senha precisa ter:</p>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li style={{ color: (password.length >= 12 && password.length <= 15) ? '#10b981' : '#fca5a5' }}>De 12 a 15 caracteres</li>
                  <li style={{ color: (/[A-Z]/.test(password) && /[a-z]/.test(password)) ? '#10b981' : '#fca5a5' }}>Letras maiúsculas e minúsculas</li>
                  <li style={{ color: (/[0-9]/.test(password) && !hasSequentialNumbers(password)) ? '#10b981' : '#fca5a5' }}>Números, mas não sequenciais (ex: 123)</li>
                  <li style={{ color: ((password.match(/[^A-Za-z0-9]/g) || []).length >= 2) ? '#10b981' : '#fca5a5' }}>No mínimo 2 símbolos especiais</li>
                  <li style={{ color: (password === confirmPassword && confirmPassword.length > 0) ? '#10b981' : '#fca5a5' }}>As senhas precisam coincidir</li>
                </ul>
              </div>

              <Field label="Nome Completo" value={fullName} onChange={setFullName} placeholder="João da Silva" />

              {/* CPF com validação */}
              <div>
                <label style={labelStyle}>CPF</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={cpf}
                    onChange={e => handleCpfChange(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    style={{
                      ...inputStyle,
                      flex: 1,
                      borderColor: cpfStatus
                        ? cpfStatus.status === 'valid' ? '#10b981'
                          : cpfStatus.status === 'idle' ? 'rgba(255,255,255,0.15)'
                          : '#ef4444'
                        : 'rgba(255,255,255,0.15)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCpfValidate}
                    disabled={cpfChecking || cpf.replace(/\D/g, '').length < 11}
                    style={{
                      padding: '0 1rem',
                      background: cpfIsOk ? '#10b981' : 'var(--kate-yellow)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'var(--kate-dark-blue)',
                      fontWeight: 700,
                      cursor: cpfChecking ? 'wait' : 'pointer',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap',
                      opacity: cpf.replace(/\D/g, '').length < 11 ? 0.4 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {cpfChecking ? '...' : cpfIsOk ? '✓ Válido' : 'Verificar'}
                  </button>
                </div>

                {/* Feedback CPF */}
                {cpfStatus && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    background: cpfStatus.status === 'valid'
                      ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${cpfStatus.status === 'valid' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: cpfStatus.status === 'valid' ? '#6ee7b7' : '#fca5a5',
                  }}>
                    <span>{cpfStatus.status === 'valid' ? '✅' : '❌'} {cpfStatus.message}</span>
                    {cpfStatus.name && (
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
                        Titular: <strong style={{ color: 'white' }}>{cpfStatus.name}</strong>
                      </span>
                    )}
                    {cpfStatus.birthDateMatch === true && (
                      <span style={{ color: '#6ee7b7', fontSize: '0.75rem' }}>✅ Data de nascimento confere</span>
                    )}
                    {cpfStatus.birthDateMatch === false && (
                      <span style={{ color: '#fca5a5', fontSize: '0.75rem' }}>⚠️ Data de nascimento não confere com o cadastro</span>
                    )}
                    {cpfStatus.birthDateMatch === null && (
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>ℹ️ Informe a data de nascimento para verificação cruzada</span>
                    )}
                  </div>
                )}
              </div>

              <Field label="Telefone" value={phone} onChange={handlePhoneChange} placeholder="+55 (11) 9 0000-0000" />
              <Field
                label="Data de Nascimento"
                type="date"
                value={birthDate}
                onChange={v => { setBirthDate(v); setCpfStatus(null); /* requer re-verificação */ }}
              />

              {birthDate && cpfIsOk && cpfStatus?.birthDateMatch === undefined && (
                <p style={{ fontSize: '0.8rem', color: 'rgba(252,163,16,0.8)' }}>
                  ⚠️ Data de nascimento alterada — clique em "Verificar" novamente para confirmar o cruzamento.
                </p>
              )}

              <NavButtons
                next={() => setStep(2)}
                nextDisabled={!step1CanAdvance}
              />

              {!cpfIsOk && fullName && (
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                  Verifique o CPF para continuar
                </p>
              )}
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 className="text-h3" style={{ color: 'white' }}>Seu perfil de investidor</h2>

              <div>
                <label style={labelStyle}>Tipo de Investidor</label>
                <select value={investorType} onChange={e => setInvestorType(e.target.value)} style={inputStyle}>
                  <option style={{ color: '#000' }} value="retail">Varejo (até R$ 20.000/rodada)</option>
                  <option style={{ color: '#000' }} value="qualified">Qualificado</option>
                  <option style={{ color: '#000' }} value="professional">Profissional</option>
                  <option style={{ color: '#000' }} value="lead">Lead Investor</option>
                </select>
              </div>

              <Field label="Renda Anual (R$)" type="number" value={annualIncome} onChange={setAnnualIncome} placeholder="ex: 120000" />
              <Field label="Total em Investimentos Financeiros (R$)" type="number" value={financialInvestments} onChange={setFinancialInvestments} placeholder="ex: 50000" />

              <div style={{ background: 'rgba(252,163,16,0.1)', borderLeft: '3px solid var(--kate-yellow)', padding: '1rem', borderRadius: '0 8px 8px 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
                Conforme CVM 88, investidores de varejo têm limite de R$ 20.000 por oferta, ou até R$ 20.000 no total por doze meses.
              </div>

              <NavButtons back={() => setStep(1)} next={() => setStep(3)} nextDisabled={!annualIncome} />
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 className="text-h3" style={{ color: 'white' }}>Declarações e Termos</h2>

              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem', maxHeight: '160px', overflowY: 'auto', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--kate-yellow)' }}>Declaração de Ciência de Risco (Anexo A — CVM 88)</strong>
                <br /><br />
                Declaro que estou ciente de que o investimento em startups e empresas de pequeno porte envolve riscos elevados e pode resultar na perda total do capital investido. Entendo que os valores mobiliários adquiridos através desta plataforma têm baixa liquidez, podendo não ser possível a venda a qualquer momento. Compreendo que a Kate Equity Ltda não garante o retorno do investimento.
              </div>

              <CheckboxField checked={agreed} onChange={setAgreed} label="Li e aceito os Termos de Uso e a Política de Privacidade da Kate Equity." />
              <CheckboxField checked={agreedRisk} onChange={setAgreedRisk} label="Declaro ciência dos riscos de investimento conforme o Anexo A da Resolução CVM nº 88." />

              {errorMsg && (
                <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.875rem' }}>
                  {errorMsg}
                </div>
              )}

              <NavButtons
                back={() => setStep(2)}
                nextLabel={loading ? 'Criando perfil...' : 'Concluir cadastro'}
                next={handleFinish}
                nextDisabled={!agreed || !agreedRisk || loading}
              />
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Já tem conta?{' '}
          <Link href="/auth" style={{ color: 'var(--kate-yellow)' }}>Fazer login</Link>
        </p>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const outerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, var(--kate-dark-blue) 0%, #0d162a 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '2rem',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '16px',
  padding: '2rem',
};

export const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'rgba(255,255,255,0.8)',
  fontSize: '0.875rem',
  marginBottom: '0.5rem',
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.875rem 1rem',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  color: 'white',
  fontSize: '1rem',
  outline: 'none',
  boxSizing: 'border-box',
};

// ─── Sub-components ─────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function CheckboxField({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ marginTop: '2px', accentColor: 'var(--kate-yellow)', width: '16px', height: '16px' }} />
      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem', lineHeight: 1.5 }}>{label}</span>
    </label>
  );
}

function NavButtons({ back, next, nextDisabled, nextLabel }: {
  back?: () => void; next: () => void; nextDisabled?: boolean; nextLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
      {back && (
        <button type="button" onClick={back} style={{ flex: 1, padding: '0.875rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '0.9375rem' }}>
          Voltar
        </button>
      )}
      <button type="button" onClick={next} disabled={nextDisabled} style={{ flex: 1, padding: '0.875rem', background: nextDisabled ? 'rgba(252,163,16,0.3)' : 'var(--kate-yellow)', border: 'none', borderRadius: '8px', color: 'var(--kate-dark-blue)', fontWeight: 700, cursor: nextDisabled ? 'not-allowed' : 'pointer', fontSize: '0.9375rem', transition: 'all 0.2s' }}>
        {nextLabel ?? 'Continuar →'}
      </button>
    </div>
  );
}
