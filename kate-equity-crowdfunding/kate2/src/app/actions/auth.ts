'use server'

import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { createWalletForUser } from '@/lib/stellar/wallet'
import { Prisma } from '@prisma/client'

interface SignUpFormData {
  email: string
  password: string
  fullName?: string
  cpf?: string
  phone?: string
  birthDate?: string
  investorType?: string
  annualIncome?: string | number
  financialInvestments?: string | number
}

export async function signUpUser(formData: SignUpFormData) {
  const supabase = await createClient()

  // 0. Pre-flight: check for duplicate CPF or email in local DB
  if (formData.cpf) {
    const existingByCpf = await prisma.user.findUnique({
      where: { cpf: formData.cpf },
      select: { id: true },
    })
    if (existingByCpf) {
      return { error: 'Já existe uma conta cadastrada com este CPF. Faça login ou utilize a recuperação de senha.' }
    }
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: formData.email },
    select: { id: true },
  })
  if (existingByEmail) {
    return { error: 'Já existe uma conta cadastrada com este e-mail. Faça login ou utilize a recuperação de senha.' }
  }

  // 1. Supabase Auth signup
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: String(formData.email),
    password: String(formData.password),
  })

  if (authError || !authData.user) {
    return { error: authError?.message || 'Erro ao criar conta no Supabase' }
  }

  // 2. Prisma sync — create user + investor profile
  try {
    const user = await prisma.user.create({
      data: {
        id: authData.user.id, // Keep the same ID as Supabase
        email: formData.email,
        password_hash: '[SUPABASE_MANAGED]', // We don't store passwords here
        full_name: formData.fullName,
        cpf: formData.cpf,
        phone: formData.phone,
        birth_date: formData.birthDate ? new Date(formData.birthDate) : null,
        role: 'investor',
        status: 'active',
        investor_profile: {
          create: {
            investor_type: formData.investorType,
            annual_income: Number(formData.annualIncome) || null,
            financial_investments: Number(formData.financialInvestments) || null,
          }
        }
      }
    })

    // 3. Generate Stellar wallet (Testnet) and persist to DB
    try {
      await createWalletForUser(user.id)
    } catch (walletErr: unknown) {
      // Wallet creation is non-blocking — user can still use the platform.
      // A retry mechanism or admin action can fix this later.
      console.error('[Onboarding] Wallet creation failed (non-blocking):', (walletErr as Error).message)
    }

    return { success: true }
  } catch (err: unknown) {
    console.error('Prisma Error:', err)
    // If Prisma fails, ideally we should delete the Supabase user, but we'd need the service_role key.

    // Handle unique constraint violations with user-friendly messages
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta?.target as string[]) || []
      if (target.includes('cpf')) {
        return { error: 'Já existe uma conta cadastrada com este CPF. Faça login ou utilize a recuperação de senha.' }
      }
      if (target.includes('email')) {
        return { error: 'Já existe uma conta cadastrada com este e-mail. Faça login ou utilize a recuperação de senha.' }
      }
      return { error: 'Já existe uma conta com os dados informados. Verifique seu CPF e e-mail.' }
    }

    // Generic fallback — never leak internal error details to the client
    return { error: 'Erro inesperado ao criar sua conta. Tente novamente em alguns instantes.' }
  }
}

export async function signInUser(email: string, pass: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  })
  
  if (error) {
    return { error: error.message }
  }
  
  return { success: true }
}
