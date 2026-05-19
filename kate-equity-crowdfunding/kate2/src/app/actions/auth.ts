'use server'

import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { createWalletForUser } from '@/lib/stellar/wallet'

export async function signUpUser(formData: Record<string, string | number>) {
  const supabase = await createClient()

  // 1. Supabase Auth signup
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
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
    // For now, return an error.
    return { error: 'Erro ao salvar dados no banco de dados local. ' + (err as Error).message }
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
