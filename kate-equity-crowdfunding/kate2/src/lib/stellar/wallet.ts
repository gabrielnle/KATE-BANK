import * as StellarSdk from '@stellar/stellar-sdk'
import prisma from '@/lib/prisma'

const FRIENDBOT_URL = 'https://friendbot.stellar.org'

// ─── Core: Generate & Fund ────────────────────────────────────────────────────

/**
 * Gera uma Keypair Stellar (Ed25519) via Stellar SDK e faz uma chamada nativa
 * à API do Friendbot na Testnet para fundear a conta com 10.000 XLM de teste,
 * preparando-a para receber os tokens da âncora (BRZ, security tokens, etc.).
 *
 * Fluxo:
 *  1. `Keypair.random()` — gera par de chaves criptográficas Ed25519
 *  2. `Friendbot` — ativa a conta na Stellar Testnet (cria a entrada no ledger)
 *  3. Retorna `{ publicKey, secretKey }` para que o chamador decida a persistência
 *
 * @remarks
 * Em produção, a ativação seria feita por uma conta patrocinadora (sponsor)
 * via `CREATE_ACCOUNT` op, e a secret key seria gerenciada por um KMS
 * (AWS KMS, HashiCorp Vault) em vez de armazenada em texto plano.
 *
 * @returns Objeto com `publicKey` (endereço G...) e `secretKey` (S...)
 * @throws {Error} Se o Friendbot falhar (ex.: rate limit ou rede indisponível)
 */
export async function generateAndFundWallet(): Promise<{
  publicKey: string
  secretKey: string
}> {
  const keypair = StellarSdk.Keypair.random()
  const publicKey = keypair.publicKey()
  const secretKey = keypair.secret()

  // Activate on Testnet via Friendbot (10 000 XLM)
  const res = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`)

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error')
    throw new Error(
      `Friendbot funding failed (${res.status}): ${body}`
    )
  }

  return { publicKey, secretKey }
}

// ─── Persist to DB ─────────────────────────────────────────────────────────────

/**
 * Generate a wallet, fund it on Testnet, and persist it to the Wallet table
 * linked to the given user. Custodial MVP — secret stored in DB.
 */
export async function createWalletForUser(userId: string) {
  const { publicKey, secretKey } = await generateAndFundWallet()

  const wallet = await prisma.wallet.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      stellar_public_key: publicKey,
      encrypted_secret: secretKey, // MVP: plain-text, use KMS in prod
      custody_type: 'custodial',
      key_provider: 'kate_custody',
      status: 'active',
    },
    update: {
      stellar_public_key: publicKey,
      encrypted_secret: secretKey,
      status: 'active',
    },
  })

  return { publicKey, walletId: wallet.id }
}

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Get a user's Stellar public key from the database
 */
export async function getUserPublicKey(userId: string): Promise<string | null> {
  const wallet = await prisma.wallet.findUnique({
    where: { user_id: userId },
    select: { stellar_public_key: true },
  })
  return wallet?.stellar_public_key ?? null
}

/**
 * Check if user has a wallet
 */
export async function hasWallet(userId: string): Promise<boolean> {
  const wallet = await prisma.wallet.findUnique({
    where: { user_id: userId },
    select: { id: true },
  })
  return !!wallet
}
