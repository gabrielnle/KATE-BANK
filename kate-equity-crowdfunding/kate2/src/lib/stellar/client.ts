/**
 * Stellar blockchain client for Kate Equity
 * Supports asset creation, trustlines, NFTs and token transfers on Stellar network
 * Includes SimulatedStellarClient for development without real credentials
 */
import * as StellarSdk from '@stellar/stellar-sdk'

const TESTNET_URL = 'https://horizon-testnet.stellar.org'
const MAINNET_URL = 'https://horizon.stellar.org'

export interface StellarEnv {
  STELLAR_KATE_SECRET_KEY?: string
  STELLAR_KATE_PUBLIC_KEY?: string
  STELLAR_USE_TESTNET?: string
  STELLAR_SIMULATION_MODE?: string
}

export interface StellarAsset {
  code: string
  issuer: string
}

export interface StellarTransferResult {
  success: boolean
  txHash?: string
  error?: string
}

export interface StellarKeypair {
  publicKey: string
  secretKey: string
}

// ─── Real Stellar Client ──────────────────────────────────────────────────────

export class StellarClient {
  private server: StellarSdk.Horizon.Server
  private kateKeypair: StellarSdk.Keypair
  private network: string
  private isTestnet: boolean

  constructor(env: StellarEnv) {
    if (!env.STELLAR_KATE_SECRET_KEY) {
      throw new Error('STELLAR_KATE_SECRET_KEY not configured')
    }

    this.isTestnet = env.STELLAR_USE_TESTNET !== 'false'
    const serverUrl = this.isTestnet ? TESTNET_URL : MAINNET_URL
    this.server = new StellarSdk.Horizon.Server(serverUrl)
    this.network = this.isTestnet
      ? StellarSdk.Networks.TESTNET
      : StellarSdk.Networks.PUBLIC
    this.kateKeypair = StellarSdk.Keypair.fromSecret(env.STELLAR_KATE_SECRET_KEY)
  }

  static generateKeypair(): StellarKeypair {
    const keypair = StellarSdk.Keypair.random()
    return { publicKey: keypair.publicKey(), secretKey: keypair.secret() }
  }

  getKatePublicKey(): string {
    return this.kateKeypair.publicKey()
  }

  getNetworkInfo(): { isTestnet: boolean; network: string } {
    return { isTestnet: this.isTestnet, network: this.isTestnet ? 'testnet' : 'mainnet' }
  }

  async testConnection(): Promise<{ connected: boolean; network: string; katePublicKey: string }> {
    try {
      await this.server.loadAccount(this.kateKeypair.publicKey())
      return {
        connected: true,
        network: this.isTestnet ? 'testnet' : 'mainnet',
        katePublicKey: this.kateKeypair.publicKey(),
      }
    } catch (error: unknown) {
      const e = error as { response?: { status: number } }
      if (e.response?.status === 404) {
        return {
          connected: true,
          network: this.isTestnet ? 'testnet' : 'mainnet',
          katePublicKey: this.kateKeypair.publicKey(),
        }
      }
      throw error
    }
  }

  /**
   * Create a project security token on Stellar
   * Asset code limited to 12 characters (Stellar spec)
   */
  async createProjectAsset(
    assetCode: string,
    totalSupply: number,
    projectData: { projectId: string; projectName: string; nftUid?: string }
  ): Promise<{ assetCode: string; issuer: string; txHash: string }> {
    const code = assetCode.substring(0, 12).toUpperCase()
    const kateAccount = await this.server.loadAccount(this.kateKeypair.publicKey())

    const transaction = new StellarSdk.TransactionBuilder(kateAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.network,
    })
      .addOperation(
        StellarSdk.Operation.manageData({
          name: `PROJECT_${projectData.projectId.substring(0, 10)}`,
          value: JSON.stringify({
            asset: code,
            supply: totalSupply,
            name: projectData.projectName.substring(0, 40),
            nftUid: projectData.nftUid || null,
          }).substring(0, 64),
        })
      )
      .setTimeout(180)
      .build()

    transaction.sign(this.kateKeypair)
    const result = await this.server.submitTransaction(transaction)

    return { assetCode: code, issuer: this.kateKeypair.publicKey(), txHash: result.hash }
  }

  /**
   * Create a trustline so an investor can receive project tokens
   * Must be called before transferring tokens
   */
  async createTrustline(
    investorSecretKey: string,
    assetCode: string,
    issuerPublicKey: string
  ): Promise<{ success: boolean; txHash: string }> {
    const investorKeypair = StellarSdk.Keypair.fromSecret(investorSecretKey)
    const asset = new StellarSdk.Asset(assetCode, issuerPublicKey)
    const investorAccount = await this.server.loadAccount(investorKeypair.publicKey())

    const transaction = new StellarSdk.TransactionBuilder(investorAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.network,
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset,
          limit: '1000000000',
        })
      )
      .setTimeout(30)
      .build()

    transaction.sign(investorKeypair)
    const result = await this.server.submitTransaction(transaction)
    return { success: true, txHash: result.hash }
  }

  /**
   * Transfer tokens from Kate issuer to an investor
   */
  async transferTokens(
    investorPublicKey: string,
    assetCode: string,
    amount: number,
    memo?: string
  ): Promise<StellarTransferResult> {
    try {
      const asset = new StellarSdk.Asset(assetCode, this.kateKeypair.publicKey())
      const kateAccount = await this.server.loadAccount(this.kateKeypair.publicKey())

      let txBuilder = new StellarSdk.TransactionBuilder(kateAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.network,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: investorPublicKey,
            asset,
            amount: amount.toString(),
          })
        )
        .setTimeout(30)

      if (memo) {
        txBuilder = txBuilder.addMemo(StellarSdk.Memo.text(memo.substring(0, 28)))
      }

      const transaction = txBuilder.build()
      transaction.sign(this.kateKeypair)
      const result = await this.server.submitTransaction(transaction)
      return { success: true, txHash: result.hash }
    } catch (error: unknown) {
      const e = error as Error
      return { success: false, error: e.message || 'Transfer failed' }
    }
  }

  /**
   * Create an NFT-like unique asset on Stellar for project verification
   */
  async createNFT(
    nftCode: string,
    metadata: { projectId: string; projectName: string; verificationUrl: string }
  ): Promise<{ assetCode: string; issuer: string; txHash: string }> {
    const code = nftCode.substring(0, 12).toUpperCase()
    const kateAccount = await this.server.loadAccount(this.kateKeypair.publicKey())

    const transaction = new StellarSdk.TransactionBuilder(kateAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.network,
    })
      .addOperation(
        StellarSdk.Operation.manageData({
          name: `kate_nft_${metadata.projectId.substring(0, 8)}`,
          value: JSON.stringify({
            name: metadata.projectName.substring(0, 40),
            url: metadata.verificationUrl,
            type: 'project_nft',
            created: new Date().toISOString(),
          }),
        })
      )
      .setTimeout(30)
      .build()

    transaction.sign(this.kateKeypair)
    const result = await this.server.submitTransaction(transaction)
    return { assetCode: code, issuer: this.kateKeypair.publicKey(), txHash: result.hash }
  }

  /**
   * Fund a new account with minimum XLM (Testnet only via Friendbot)
   */
  async fundTestnetAccount(publicKey: string): Promise<boolean> {
    if (!this.isTestnet) throw new Error('Friendbot funding only available on testnet')
    try {
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
      )
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get balance for a specific asset in an account
   */
  async getAssetBalance(publicKey: string, assetCode: string): Promise<string | null> {
    try {
      const account = await this.server.loadAccount(publicKey)
      const balance = account.balances.find(
        (b) =>
          (b as StellarSdk.Horizon.HorizonApi.BalanceLine).asset_type !== 'native' &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_code === assetCode &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_issuer === this.kateKeypair.publicKey()
      )
      return balance ? balance.balance : null
    } catch {
      return null
    }
  }

  /**
   * Get all balances for an account
   */
  async getAllBalances(publicKey: string): Promise<StellarSdk.Horizon.HorizonApi.BalanceLine[]> {
    try {
      const account = await this.server.loadAccount(publicKey)
      return account.balances
    } catch {
      return []
    }
  }

  getExplorerUrl(txHash: string): string {
    const base = this.isTestnet
      ? 'https://stellar.expert/explorer/testnet'
      : 'https://stellar.expert/explorer/public'
    return `${base}/tx/${txHash}`
  }

  getAssetExplorerUrl(assetCode: string): string {
    const base = this.isTestnet
      ? 'https://stellar.expert/explorer/testnet'
      : 'https://stellar.expert/explorer/public'
    return `${base}/asset/${assetCode}-${this.kateKeypair.publicKey()}`
  }
}

// ─── Simulated Stellar Client (for dev/test without real credentials) ─────────

export class SimulatedStellarClient {
  private katePublicKey: string

  constructor() {
    this.katePublicKey = 'GSIM_KATE_EQUITY_PUBLIC_KEY_SIMULATED_0000000000'
  }

  static generateKeypair(): StellarKeypair {
    const buffer = new Uint8Array(4)
    crypto.getRandomValues(buffer)
    const id = Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    return {
      publicKey: `G${id}SIMULATED000000000000000000000000000000000`,
      secretKey: `S${id}SIMULATED000000000000000000000000000000000`,
    }
  }

  getKatePublicKey(): string { return this.katePublicKey }
  getNetworkInfo(): { isTestnet: boolean; network: string } {
    return { isTestnet: true, network: 'simulated' }
  }

  async testConnection(): Promise<{ connected: boolean; network: string; katePublicKey: string }> {
    return { connected: true, network: 'simulated', katePublicKey: this.katePublicKey }
  }

  async createProjectAsset(
    assetCode: string,
    _totalSupply: number,
    _projectData: { projectId: string; projectName: string; nftUid?: string }
  ): Promise<{ assetCode: string; issuer: string; txHash: string }> {
    const code = assetCode.substring(0, 12).toUpperCase()
    return {
      assetCode: code,
      issuer: this.katePublicKey,
      txHash: `SIM_TX_ASSET_${code}_${Date.now().toString(36).toUpperCase()}`,
    }
  }

  async createTrustline(
    _investorSecretKey: string,
    assetCode: string,
    _issuerPublicKey: string
  ): Promise<{ success: boolean; txHash: string }> {
    return {
      success: true,
      txHash: `SIM_TX_TRUST_${assetCode}_${Date.now().toString(36).toUpperCase()}`,
    }
  }

  async transferTokens(
    _investorPublicKey: string,
    assetCode: string,
    _amount: number,
    _memo?: string
  ): Promise<StellarTransferResult> {
    return {
      success: true,
      txHash: `SIM_TX_TRANSFER_${assetCode}_${Date.now().toString(36).toUpperCase()}`,
    }
  }

  async createNFT(
    nftCode: string,
    _metadata: { projectId: string; projectName: string; verificationUrl: string }
  ): Promise<{ assetCode: string; issuer: string; txHash: string }> {
    const code = nftCode.substring(0, 12).toUpperCase()
    return {
      assetCode: code,
      issuer: this.katePublicKey,
      txHash: `SIM_TX_NFT_${code}_${Date.now().toString(36).toUpperCase()}`,
    }
  }

  async fundTestnetAccount(_publicKey: string): Promise<boolean> { return true }

  async getAssetBalance(_publicKey: string, _assetCode: string): Promise<string | null> {
    return '1000'
  }

  async getAllBalances(_publicKey: string): Promise<{ asset_type: string; balance: string; asset_code?: string }[]> {
    return [
      { asset_type: 'native', balance: '100' },
      { asset_type: 'credit_alphanum12', asset_code: 'KATESIM', balance: '1000' },
    ]
  }

  getExplorerUrl(txHash: string): string {
    return `https://stellar.expert/explorer/testnet/tx/${txHash}`
  }

  getAssetExplorerUrl(assetCode: string): string {
    return `https://stellar.expert/explorer/testnet/asset/${assetCode}-${this.katePublicKey}`
  }
}

// ─── PIX → BRZ Simulation (SEP-24 MVP) ──────────────────────────────────────

/**
 * Hardcoded "Banco Emissor BRZ" keypair for Testnet simulation.
 * This account issues the BRZ stablecoin on the Stellar Testnet.
 * In production, this would be a real regulated stablecoin issuer.
 */
const BANK_BRZ_SECRET = process.env.BANK_BRZ_SECRET || ''
const BANK_BRZ_PUBLIC = 'GBZSVPMLAFST5U6BNSPM5ISWY7DL7HVETNFHZWZD3A63KMMO6MO7T4WH'

/**
 * Anchor Backend Simulation (SEP-24) — Depósito PIX → BRZ na Stellar Testnet.
 *
 * Simula o fluxo completo de um Anchor regulado que recebe uma transferência
 * PIX (off-chain) e emite stablecoins BRZ (on-chain) na conta do investidor,
 * seguindo a especificação SEP-24 (Interactive Anchor/Client Deposit).
 *
 * Etapas on-chain:
 *  1. **ChangeTrust** — O investidor autoriza a recepção do ativo BRZ
 *     emitido pela âncora (operação assinada com a secret key do investidor).
 *  2. **Payment** — A âncora emite (mint) a quantidade de BRZ correspondente
 *     ao valor do PIX, enviando diretamente ao endereço do investidor
 *     (operação assinada com a secret key da âncora / banco emissor).
 *  3. **Submit** — Ambas as transações são submetidas ao Horizon (Testnet).
 *
 * @remarks
 * Em produção, a âncora seria um emissor regulado de stablecoin (ex.: Transfero)
 * e a emissão seguiria o fluxo SEP-24 completo com KYC, callback e custódia
 * segregada. A secret key do investidor seria gerenciada via KMS, não em DB.
 *
 * @param userPublicKey  - Endereço Stellar do investidor (G...)
 * @param userSecretKey  - Chave secreta do investidor (S...) — custódia MVP
 * @param amount         - Montante em BRZ (string, ex.: "1000" = R$ 1.000)
 * @returns Hash da transação de pagamento + metadados do ativo emitido
 * @throws {Error} Se a keypair for inválida ou o Horizon rejeitar a transação
 */
export async function simulatePixToBRZ(
  userPublicKey: string,
  userSecretKey: string,
  amount: string
): Promise<{ success: boolean; txHash: string; assetCode: string; issuer: string }> {
  const server = new StellarSdk.Horizon.Server(TESTNET_URL)
  const networkPassphrase = StellarSdk.Networks.TESTNET

  // ── Keypair validation ──────────────────────────────────────────────────────
  let bankKeypair: StellarSdk.Keypair
  let userKeypair: StellarSdk.Keypair

  if (!BANK_BRZ_SECRET) {
    throw new Error('BANK_BRZ_SECRET não configurada.')
  }

  try {
    bankKeypair = StellarSdk.Keypair.fromSecret(BANK_BRZ_SECRET)
  } catch (err) {
    console.error('[SEP-24] Invalid Anchor (bank) secret key:', err)
    throw new Error('Configuração do banco BRZ inválida. Contate o administrador.')
  }

  try {
    userKeypair = StellarSdk.Keypair.fromSecret(userSecretKey)
  } catch (err) {
    console.error('[SEP-24] Invalid investor secret key:', err)
    throw new Error('Chave da wallet inválida. Recrie sua wallet no onboarding.')
  }

  // BRZ asset issued by the Anchor (bank)
  const brzAsset = new StellarSdk.Asset('BRZ', BANK_BRZ_PUBLIC)

  // ── Pre-flight: ensure both accounts exist on Testnet (Friendbot) ───────────
  try {
    await server.loadAccount(BANK_BRZ_PUBLIC)
  } catch {
    console.info('[SEP-24] Funding Anchor account via Friendbot...')
    await fetch(`https://friendbot.stellar.org?addr=${BANK_BRZ_PUBLIC}`)
    await new Promise(r => setTimeout(r, 2000))
  }

  try {
    await server.loadAccount(userPublicKey)
  } catch {
    console.info('[SEP-24] Funding investor account via Friendbot...')
    await fetch(`https://friendbot.stellar.org?addr=${userPublicKey}`)
    await new Promise(r => setTimeout(r, 2000))
  }

  // ── Step 1: Build ChangeTrust Operation for BRZ Asset ───────────────────────
  // The investor must authorize receipt of the BRZ token before the Anchor
  // can send it. This creates a trustline entry in the investor's account.
  const userAccount = await server.loadAccount(userPublicKey)
  const trustTx = new StellarSdk.TransactionBuilder(userAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: brzAsset,
        limit: '100000000', // 100M BRZ max trustline limit
      })
    )
    .setTimeout(30)
    .build()

  trustTx.sign(userKeypair)
  await server.submitTransaction(trustTx)
  console.info(`[SEP-24] Trustline BRZ established for ${userPublicKey}`)

  // ── Step 2: Anchor issues Payment operation to User Public Key ──────────────
  // The Anchor (bank) mints BRZ by sending a payment from its issuing account
  // to the investor's address. This is the on-chain equivalent of "PIX received".
  const bankAccount = await server.loadAccount(BANK_BRZ_PUBLIC)
  const payTx = new StellarSdk.TransactionBuilder(bankAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: userPublicKey,
        asset: brzAsset,
        amount, // e.g. "1000" = R$ 1.000,00
      })
    )
    .addMemo(StellarSdk.Memo.text('PIX BRZ Deposit'))
    .setTimeout(30)
    .build()

  payTx.sign(bankKeypair)

  // ── Step 3: Submit transaction to Horizon ───────────────────────────────────
  const result = await server.submitTransaction(payTx)
  console.info(`[SEP-24] BRZ issued: ${amount} BRZ → ${userPublicKey} | tx: ${result.hash}`)

  return {
    success: true,
    txHash: result.hash,
    assetCode: 'BRZ',
    issuer: BANK_BRZ_PUBLIC,
  }
}

// ─── DeFi Swap & Invest (SDEX AMM — Path Payment) ───────────────────────────

/**
 * USDC issuer on Stellar Testnet (Circle's test anchor).
 * In production this would be the real USDC issuer on Stellar mainnet.
 */
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

/**
 * Platform Escrow address — receives investment funds.
 * In production this would be the Soroban PrimaryEscrow contract address.
 * For MVP, we use the bank/platform account.
 */
const ESCROW_PUBLIC = BANK_BRZ_PUBLIC

/**
 * Execute a DeFi swap from USDC → BRZ via Stellar's built-in SDEX (DEX)
 * and deliver the BRZ to the platform escrow.
 *
 * Uses `pathPaymentStrictReceive` — the user specifies how much BRZ they
 * want to arrive at the escrow, and the SDEX finds the best route through
 * available liquidity pools and order books.
 *
 * This demonstrates how Stellar's native AMM eliminates the need for
 * external DEX aggregators or bridges.
 *
 * @param userSecretKey - Investor's custodial secret key
 * @param amountUSDC    - Maximum USDC the user is willing to spend (slippage buffer)
 * @param expectedBRZ   - Exact BRZ amount to deliver to escrow
 */
export async function executeDefiSwapAndInvest(
  userSecretKey: string,
  amountUSDC: string,
  expectedBRZ: string
): Promise<{ success: boolean; txHash: string; route: string }> {
  const server = new StellarSdk.Horizon.Server(TESTNET_URL)
  const networkPassphrase = StellarSdk.Networks.TESTNET

  const userKeypair = StellarSdk.Keypair.fromSecret(userSecretKey)
  const userPublicKey = userKeypair.publicKey()

  const usdcAsset = new StellarSdk.Asset('USDC', USDC_ISSUER)
  const brzAsset = new StellarSdk.Asset('BRZ', BANK_BRZ_PUBLIC)

  // Load the user's account
  const userAccount = await server.loadAccount(userPublicKey)

  // pathPaymentStrictReceive:
  //   - sendAsset: USDC (what the user pays with)
  //   - sendMax: maximum USDC to spend (includes slippage tolerance)
  //   - destination: escrow address
  //   - destAsset: BRZ (what the escrow receives)
  //   - destAmount: exact BRZ to deliver
  //   - path: [] = let Stellar find the optimal route through the SDEX
  const tx = new StellarSdk.TransactionBuilder(userAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset: usdcAsset,
        sendMax: amountUSDC,        // slippage buffer (e.g., "210" for ~5% on 200 USDC)
        destination: ESCROW_PUBLIC,
        destAsset: brzAsset,
        destAmount: expectedBRZ,    // exact BRZ to arrive (e.g., "1000")
        path: [],                   // SDEX auto-routes through best liquidity
      })
    )
    .addMemo(StellarSdk.Memo.text('INVEST USDC>BRZ SDEX'))
    .setTimeout(60)
    .build()

  tx.sign(userKeypair)
  const result = await server.submitTransaction(tx)

  return {
    success: true,
    txHash: result.hash,
    route: 'USDC → SDEX → BRZ → Escrow',
  }
}

/**
 * Direct BRZ payment from investor → escrow.
 * Used when the investor already has BRZ (from PIX deposit).
 */
export async function executeDirectBrzInvest(
  userSecretKey: string,
  amount: string
): Promise<{ success: boolean; txHash: string; route: string }> {
  const server = new StellarSdk.Horizon.Server(TESTNET_URL)
  const networkPassphrase = StellarSdk.Networks.TESTNET

  const userKeypair = StellarSdk.Keypair.fromSecret(userSecretKey)
  const brzAsset = new StellarSdk.Asset('BRZ', BANK_BRZ_PUBLIC)

  const userAccount = await server.loadAccount(userKeypair.publicKey())

  const tx = new StellarSdk.TransactionBuilder(userAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: ESCROW_PUBLIC,
        asset: brzAsset,
        amount,
      })
    )
    .addMemo(StellarSdk.Memo.text('INVEST BRZ DIRECT'))
    .setTimeout(30)
    .build()

  tx.sign(userKeypair)
  const result = await server.submitTransaction(tx)

  return {
    success: true,
    txHash: result.hash,
    route: 'BRZ → Escrow (direct)',
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createStellarClient(env: StellarEnv): StellarClient | SimulatedStellarClient {
  if (!env.STELLAR_KATE_SECRET_KEY || env.STELLAR_SIMULATION_MODE === 'true') {
    console.log('[Stellar] Using SimulatedStellarClient')
    return new SimulatedStellarClient()
  }
  console.log('[Stellar] Using real StellarClient on', env.STELLAR_USE_TESTNET !== 'false' ? 'TESTNET' : 'MAINNET')
  return new StellarClient(env)
}

export function getStellarConfigDebug(env: StellarEnv) {
  return {
    hasSecretKey: !!env.STELLAR_KATE_SECRET_KEY,
    hasPublicKey: !!env.STELLAR_KATE_PUBLIC_KEY,
    isTestnet: env.STELLAR_USE_TESTNET !== 'false',
    isSimulated: !env.STELLAR_KATE_SECRET_KEY || env.STELLAR_SIMULATION_MODE === 'true',
  }
}

