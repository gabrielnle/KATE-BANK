'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { Users, Search, Wallet, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, Plus } from 'lucide-react'

type User = {
  id: string
  email: string
  full_name: string | null
  role: string | null
  created_at: Date
  investor_profile: {
    investor_type: string | null
    annual_limit: number | null
    used_limit: number | null
  } | null
  wallet: { stellar_public_key: string } | null
}

const investorTypeBadge: Record<string, string> = {
  retail:       'bg-blue-400/15 text-blue-400',
  qualified:    'bg-green-400/15 text-green-400',
  professional: 'bg-purple-400/15 text-purple-400',
  lead:         'bg-amber-400/15 text-amber-400',
}

export default function AdminInvestidoresPage() {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: users, isLoading, refetch } = trpc.investors.listAll.useQuery()

    const updateRole = trpc.admin.updateUserRole.useMutation({ onSuccess: () => refetch() })
  const createWallet = trpc.admin.createWalletForUser.useMutation({ onSuccess: () => refetch() })

  const filtered = (users ?? []).filter((u: User) =>
    !search ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="text-kate-yellow" /> Investidores
          </h1>
          <p className="text-white/40 text-sm mt-1">{filtered.length} usuários</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-kate-dark-blue border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-kate-yellow/50 transition-colors"
        />
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="text-center py-16 text-white/40 text-sm">Carregando...</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 text-white/30">Nenhum investidor encontrado.</div>
        )}
        {filtered.map((user: User) => {
          const profile = user.investor_profile
          const isExpanded = expanded === user.id
          const limitUsed = profile ? Math.min(((profile.used_limit ?? 0) / (profile.annual_limit ?? 1)) * 100, 100) : 0

          return (
            <div
              key={user.id}
              className="bg-kate-dark-blue border border-white/10 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : user.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/2 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-kate-yellow/10 flex items-center justify-center shrink-0">
                  <span className="text-kate-yellow font-bold text-sm">
                    {(user.full_name || user.email)[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">{user.full_name || '—'}</p>
                  <p className="text-white/40 text-xs">{user.email}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {/* Investor type badge */}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${investorTypeBadge[profile?.investor_type ?? 'retail'] ?? 'bg-white/10 text-white/40'}`}>
                    {profile?.investor_type ?? 'sem perfil'}
                  </span>
                  {/* Wallet */}
                  {user.wallet
                    ? <CheckCircle size={15} className="text-green-400" />
                    : <XCircle size={15} className="text-white/20" />
                  }
                  <span className="text-xs text-white/30 font-mono">
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  {isExpanded
                    ? <ChevronUp size={14} className="text-white/40" />
                    : <ChevronDown size={14} className="text-white/40" />
                  }
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-white/10 px-5 pb-5 pt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-white/30 text-xs mb-1">Tipo</p>
                      <p className="text-white text-sm font-medium capitalize">{profile?.investor_type ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-white/30 text-xs mb-1">Limite Anual CVM</p>
                      <p className="text-white text-sm font-medium">
                        {profile?.annual_limit != null ? `R$ ${profile.annual_limit.toLocaleString('pt-BR')}` : 'Ilimitado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/30 text-xs mb-1">Utilizado</p>
                      <p className="text-white text-sm font-medium">
                        R$ {(profile?.used_limit ?? 0).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/30 text-xs mb-1">Role</p>
                      <select
                        value={user.role ?? 'investor'}
                        onChange={e => updateRole.mutate({ user_id: user.id, role: e.target.value as any })}
                        className="bg-white/5 text-white text-xs px-2 py-1 rounded-lg border border-white/10 focus:outline-none"
                      >
                        <option value="investor">investor</option>
                        <option value="issuer">issuer</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                  </div>

                  {profile?.annual_limit != null && (
                    <div>
                      <div className="flex justify-between text-xs text-white/30 mb-1">
                        <span>Limite utilizado</span>
                        <span>{limitUsed.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full">
                        <div
                          className={`h-full rounded-full transition-all ${limitUsed > 80 ? 'bg-red-400' : 'bg-kate-yellow'}`}
                          style={{ width: `${limitUsed}%` }}
                        />
                      </div>
                    </div>
                  )}

                                    {user.wallet ? (
                    <div>
                      <p className="text-white/30 text-xs mb-1 flex items-center gap-1">
                        <Wallet size={11} /> Wallet Stellar
                      </p>
                      <code className="text-white/50 text-xs font-mono break-all">{user.wallet.stellar_public_key}</code>
                    </div>
                  ) : (
                    <div>
                      <p className="text-white/30 text-xs mb-2 flex items-center gap-1">
                        <Wallet size={11} /> Wallet Stellar
                      </p>
                      <button
                        onClick={() => createWallet.mutate({ user_id: user.id })}
                        disabled={createWallet.isPending}
                        className="flex items-center gap-2 px-3 py-1.5 bg-kate-yellow text-kate-navy text-xs font-bold rounded-lg hover:brightness-110 transition-colors disabled:opacity-50"
                      >
                        <Plus size={14} />
                        {createWallet.isPending ? 'Criando...' : 'Criar Wallet'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
