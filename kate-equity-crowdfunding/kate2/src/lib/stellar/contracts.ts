/**
 * Soroban Smart Contracts — Camada de integração TypeScript.
 *
 * Este módulo fornece funções utilitárias para interagir com os três
 * contratos Soroban deployados na Stellar Testnet/Futurenet:
 *
 * 1. **PrimaryEscrow** — Escrow regulatório CVM 88 com release automático
 * 2. **VestingSchedule** — Desbloqueio gradual de tokens RWA com cliff
 * 3. **ComplianceGate** — Registro KYC on-chain descentralizado
 *
 * @remarks
 * Os contratos são compilados em Rust/WASM e deployados via `stellar-cli`.
 * A interação do frontend é feita via `@stellar/stellar-sdk` usando
 * `SorobanRpc.Server` para simular e submeter transações de invocação.
 */
import * as StellarSdk from '@stellar/stellar-sdk'

const SOROBAN_TESTNET_URL = 'https://soroban-testnet.stellar.org'
const HORIZON_TESTNET_URL = 'https://horizon-testnet.stellar.org'
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET

// ─── Contract Addresses (set after deployment via stellar-cli) ──────────────

/**
 * Endereços dos contratos Soroban deployados.
 * Estes são configurados via environment variables após o deploy.
 *
 * Para deployar:
 *   stellar contract deploy --wasm <path>.wasm --network testnet --source deployer
 */
const ESCROW_CONTRACT_ID = process.env.SOROBAN_ESCROW_CONTRACT_ID || ''
const VESTING_CONTRACT_ID = process.env.SOROBAN_VESTING_CONTRACT_ID || ''
const COMPLIANCE_CONTRACT_ID = process.env.SOROBAN_COMPLIANCE_CONTRACT_ID || ''

// ─── Soroban RPC Helper ─────────────────────────────────────────────────────

/**
 * Cria e submete uma transação de invocação de contrato Soroban.
 *
 * Fluxo:
 * 1. Monta a transação com `invokeContract` operation
 * 2. Simula via Soroban RPC para obter footprint e fees
 * 3. Assina com a keypair do chamador
 * 4. Submete ao Horizon e aguarda confirmação
 *
 * @param contractId - ID do contrato Soroban (C...)
 * @param method - Nome do método a invocar
 * @param args - Argumentos como `xdr.ScVal[]`
 * @param signerSecret - Secret key do assinante
 * @returns Hash da transação e resultado
 */
async function invokeSorobanContract(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  signerSecret: string
): Promise<{ txHash: string; result: StellarSdk.xdr.ScVal | null }> {
  const sorobanServer = new StellarSdk.rpc.Server(SOROBAN_TESTNET_URL)
  const signer = StellarSdk.Keypair.fromSecret(signerSecret)
  const account = await sorobanServer.getAccount(signer.publicKey())

  const contract = new StellarSdk.Contract(contractId)

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  // Simulate to get the prepared transaction
  const simulated = await sorobanServer.simulateTransaction(tx)

  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Soroban simulation failed: ${simulated.error}`)
  }

  const preparedTx = StellarSdk.rpc.assembleTransaction(
    tx,
    simulated
  ).build()

  preparedTx.sign(signer)

  const sent = await sorobanServer.sendTransaction(preparedTx)

  if (sent.status === 'ERROR') {
    throw new Error(`Transaction send failed: ${sent.errorResult?.toXDR('base64')}`)
  }

  // Poll for result
  let getResponse = await sorobanServer.getTransaction(sent.hash)
  while (getResponse.status === 'NOT_FOUND') {
    await new Promise(resolve => setTimeout(resolve, 1000))
    getResponse = await sorobanServer.getTransaction(sent.hash)
  }

  if (getResponse.status === 'SUCCESS') {
    console.info(`[Soroban] Contract ${method} executed successfully | tx: ${sent.hash}`)
    return {
      txHash: sent.hash,
      result: getResponse.resultMetaXdr
        ?.v3()
        ?.sorobanMeta()
        ?.returnValue() ?? null,
    }
  }

  throw new Error(`Transaction failed with status: ${getResponse.status}`)
}

// ─── PrimaryEscrow Functions ────────────────────────────────────────────────

/**
 * Cria um novo escrow para uma oferta de captação.
 *
 * @param adminSecret - Secret key do admin da plataforma
 * @param offerId - ID da oferta (UUID)
 * @param issuerPublicKey - Endereço Stellar do emissor
 * @param tokenContractId - Endereço SAC do token BRZ
 * @param minTarget - Meta mínima em unidades (ex: 100000 = R$ 100k)
 * @param deadlineTimestamp - Timestamp Unix do encerramento
 */
export async function createEscrow(
  adminSecret: string,
  offerId: string,
  issuerPublicKey: string,
  tokenContractId: string,
  minTarget: number,
  deadlineTimestamp: number
) {
  if (!ESCROW_CONTRACT_ID) {
    throw new Error('SOROBAN_ESCROW_CONTRACT_ID não configurado. Deploy o contrato primeiro.')
  }

  const args = [
    StellarSdk.nativeToScVal(offerId, { type: 'string' }),
    StellarSdk.nativeToScVal(issuerPublicKey, { type: 'address' }),
    StellarSdk.nativeToScVal(tokenContractId, { type: 'address' }),
    StellarSdk.nativeToScVal(BigInt(minTarget), { type: 'i128' }),
    StellarSdk.nativeToScVal(deadlineTimestamp, { type: 'u64' }),
  ]

  return invokeSorobanContract(ESCROW_CONTRACT_ID, 'create_escrow', args, adminSecret)
}

/**
 * Investidor deposita BRZ no escrow de uma oferta.
 */
export async function depositToEscrow(
  investorSecret: string,
  offerId: string,
  investorPublicKey: string,
  amount: number
) {
  if (!ESCROW_CONTRACT_ID) {
    throw new Error('SOROBAN_ESCROW_CONTRACT_ID não configurado.')
  }

  const args = [
    StellarSdk.nativeToScVal(offerId, { type: 'string' }),
    StellarSdk.nativeToScVal(investorPublicKey, { type: 'address' }),
    StellarSdk.nativeToScVal(BigInt(amount), { type: 'i128' }),
  ]

  return invokeSorobanContract(ESCROW_CONTRACT_ID, 'deposit', args, investorSecret)
}

/**
 * Admin libera os fundos do escrow para o emissor (meta atingida).
 */
export async function releaseEscrow(adminSecret: string, offerId: string) {
  if (!ESCROW_CONTRACT_ID) {
    throw new Error('SOROBAN_ESCROW_CONTRACT_ID não configurado.')
  }

  const args = [
    StellarSdk.nativeToScVal(offerId, { type: 'string' }),
  ]

  return invokeSorobanContract(ESCROW_CONTRACT_ID, 'release', args, adminSecret)
}

// ─── VestingSchedule Functions ──────────────────────────────────────────────

/**
 * Cria um vesting schedule para tokens RWA de um investidor.
 *
 * @param adminSecret - Secret key do admin
 * @param beneficiaryPublicKey - Endereço do investidor beneficiário
 * @param tokenContractId - Endereço SAC do token RWA
 * @param totalAmount - Total de tokens no vesting
 * @param cliffDurationSeconds - Duração do cliff em segundos
 * @param totalDurationSeconds - Duração total do vesting em segundos
 */
export async function createVestingSchedule(
  adminSecret: string,
  beneficiaryPublicKey: string,
  tokenContractId: string,
  totalAmount: number,
  cliffDurationSeconds: number,
  totalDurationSeconds: number
) {
  if (!VESTING_CONTRACT_ID) {
    throw new Error('SOROBAN_VESTING_CONTRACT_ID não configurado.')
  }

  const args = [
    StellarSdk.nativeToScVal(beneficiaryPublicKey, { type: 'address' }),
    StellarSdk.nativeToScVal(tokenContractId, { type: 'address' }),
    StellarSdk.nativeToScVal(BigInt(totalAmount), { type: 'i128' }),
    StellarSdk.nativeToScVal(cliffDurationSeconds, { type: 'u64' }),
    StellarSdk.nativeToScVal(totalDurationSeconds, { type: 'u64' }),
  ]

  return invokeSorobanContract(VESTING_CONTRACT_ID, 'create_schedule', args, adminSecret)
}

/**
 * Investidor resgata tokens vestidos disponíveis.
 */
export async function claimVestedTokens(beneficiarySecret: string, beneficiaryPublicKey: string) {
  if (!VESTING_CONTRACT_ID) {
    throw new Error('SOROBAN_VESTING_CONTRACT_ID não configurado.')
  }

  const args = [
    StellarSdk.nativeToScVal(beneficiaryPublicKey, { type: 'address' }),
  ]

  return invokeSorobanContract(VESTING_CONTRACT_ID, 'claim', args, beneficiarySecret)
}

// ─── ComplianceGate Functions ───────────────────────────────────────────────

/**
 * Admin registra um endereço como KYC-approved on-chain.
 *
 * @param adminSecret - Secret key do admin da plataforma
 * @param investorPublicKey - Endereço Stellar do investidor aprovado
 * @param expiryTimestamp - Timestamp Unix de expiração do KYC
 * @param riskLevel - Nível de risco (1=baixo, 2=médio, 3=alto)
 */
export async function registerKycOnChain(
  adminSecret: string,
  investorPublicKey: string,
  expiryTimestamp: number,
  riskLevel: number
) {
  if (!COMPLIANCE_CONTRACT_ID) {
    throw new Error('SOROBAN_COMPLIANCE_CONTRACT_ID não configurado.')
  }

  const args = [
    StellarSdk.nativeToScVal(investorPublicKey, { type: 'address' }),
    StellarSdk.nativeToScVal(expiryTimestamp, { type: 'u64' }),
    StellarSdk.nativeToScVal(riskLevel, { type: 'u32' }),
  ]

  return invokeSorobanContract(COMPLIANCE_CONTRACT_ID, 'register_kyc', args, adminSecret)
}

/**
 * Verifica se um endereço está em compliance KYC on-chain.
 * Consulta read-only (não precisa de assinatura).
 */
export async function checkComplianceOnChain(investorPublicKey: string): Promise<boolean> {
  if (!COMPLIANCE_CONTRACT_ID) {
    return false // No contract deployed — skip compliance check
  }

  try {
    const sorobanServer = new StellarSdk.rpc.Server(SOROBAN_TESTNET_URL)
    const contract = new StellarSdk.Contract(COMPLIANCE_CONTRACT_ID)

    // For read-only queries, use any valid account
    const tempKeypair = StellarSdk.Keypair.random()
    await fetch(`https://friendbot.stellar.org?addr=${tempKeypair.publicKey()}`)
    await new Promise(r => setTimeout(r, 2000))
    const account = await sorobanServer.getAccount(tempKeypair.publicKey())

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          'is_compliant',
          StellarSdk.nativeToScVal(investorPublicKey, { type: 'address' })
        )
      )
      .setTimeout(30)
      .build()

    const simulated = await sorobanServer.simulateTransaction(tx)

    if (StellarSdk.rpc.Api.isSimulationSuccess(simulated) && simulated.result) {
      return StellarSdk.scValToNative(simulated.result.retval) as boolean
    }

    return false
  } catch {
    console.error('[Soroban] Compliance check failed, defaulting to false')
    return false
  }
}

// ─── Contract Info ──────────────────────────────────────────────────────────

/**
 * Retorna informações de configuração dos contratos Soroban.
 * Útil para debug e exibição no dashboard admin.
 */
export function getSorobanContractsInfo() {
  return {
    escrow: {
      contractId: ESCROW_CONTRACT_ID || null,
      deployed: !!ESCROW_CONTRACT_ID,
    },
    vesting: {
      contractId: VESTING_CONTRACT_ID || null,
      deployed: !!VESTING_CONTRACT_ID,
    },
    compliance: {
      contractId: COMPLIANCE_CONTRACT_ID || null,
      deployed: !!COMPLIANCE_CONTRACT_ID,
    },
    network: 'testnet',
    sorobanRpcUrl: SOROBAN_TESTNET_URL,
  }
}
