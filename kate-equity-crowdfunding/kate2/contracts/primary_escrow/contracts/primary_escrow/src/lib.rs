#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String,
};

/// Status do escrow de uma oferta
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum EscrowStatus {
    /// Escrow aberto para receber depósitos
    Active,
    /// Meta atingida — fundos liberados ao emissor
    Released,
    /// Prazo expirado sem atingir meta — reembolso habilitado
    Expired,
}

/// Dados armazenados por oferta no escrow
#[contracttype]
#[derive(Clone)]
pub struct EscrowState {
    /// Endereço do emissor (recebe os fundos quando a meta é atingida)
    pub issuer: Address,
    /// Endereço do token BRZ (SAC — Stellar Asset Contract)
    pub token: Address,
    /// Meta mínima em stroops (1 BRZ = 10^7 stroops)
    pub min_target: i128,
    /// Total armazenado no escrow
    pub total_raised: i128,
    /// Deadline (timestamp Unix em segundos)
    pub deadline: u64,
    /// Status atual
    pub status: EscrowStatus,
}

/// Chave de storage para depósitos individuais
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Estado do escrow para uma oferta
    Escrow(String),
    /// Depósito de um investidor em uma oferta: (offer_id, investor)
    Deposit(String, Address),
    /// Administrador do contrato
    Admin,
}

/// PrimaryEscrow — Contrato de custódia para ofertas de equity crowdfunding.
///
/// Implementa o padrão de escrow regulatório (CVM 88):
/// - Investidores depositam BRZ durante o período de captação
/// - Se a meta mínima for atingida, admin libera fundos ao emissor
/// - Se o prazo expirar sem atingir a meta, investidores podem solicitar reembolso
///
/// Em produção, o admin seria um multisig ou DAO da plataforma.
#[contract]
pub struct PrimaryEscrow;

#[contractimpl]
impl PrimaryEscrow {
    /// Inicializa o contrato definindo o administrador da plataforma.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Cria um novo escrow para uma oferta de captação.
    ///
    /// # Parâmetros
    /// - `offer_id`: Identificador único da oferta (ex: UUID do DB)
    /// - `issuer`: Endereço Stellar do emissor que receberá os fundos
    /// - `token`: Endereço SAC do token BRZ na Stellar
    /// - `min_target`: Meta mínima de captação (em unidades do token)
    /// - `deadline`: Timestamp Unix do encerramento da oferta
    pub fn create_escrow(
        env: Env,
        offer_id: String,
        issuer: Address,
        token: Address,
        min_target: i128,
        deadline: u64,
    ) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let state = EscrowState {
            issuer,
            token,
            min_target,
            total_raised: 0,
            deadline,
            status: EscrowStatus::Active,
        };

        env.storage().persistent().set(&DataKey::Escrow(offer_id), &state);
    }

    /// Investidor deposita tokens BRZ no escrow.
    ///
    /// Transfere `amount` BRZ da carteira do investidor para o contrato.
    /// O depósito individual é rastreado para possível reembolso.
    pub fn deposit(env: Env, offer_id: String, investor: Address, amount: i128) {
        investor.require_auth();

        let mut state: EscrowState = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(offer_id.clone()))
            .expect("Escrow not found");

        if state.status != EscrowStatus::Active {
            panic!("Escrow is not active");
        }

        if env.ledger().timestamp() > state.deadline {
            panic!("Escrow deadline has passed");
        }

        // Transfer BRZ from investor to this contract
        let contract_address = env.current_contract_address();
        token::Client::new(&env, &state.token).transfer(
            &investor,
            &contract_address,
            &amount,
        );

        // Track individual deposit
        let deposit_key = DataKey::Deposit(offer_id.clone(), investor);
        let previous: i128 = env
            .storage()
            .persistent()
            .get(&deposit_key)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&deposit_key, &(previous + amount));

        // Update total raised
        state.total_raised += amount;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(offer_id), &state);
    }

    /// Verifica se a meta mínima da oferta foi atingida.
    pub fn check_goal(env: Env, offer_id: String) -> bool {
        let state: EscrowState = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(offer_id))
            .expect("Escrow not found");
        state.total_raised >= state.min_target
    }

    /// Admin libera os fundos do escrow para o emissor.
    ///
    /// Só pode ser chamado quando a meta mínima foi atingida.
    /// Transfere todo o saldo BRZ do contrato para o endereço do emissor.
    pub fn release(env: Env, offer_id: String) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut state: EscrowState = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(offer_id.clone()))
            .expect("Escrow not found");

        if state.status != EscrowStatus::Active {
            panic!("Escrow already finalized");
        }
        if state.total_raised < state.min_target {
            panic!("Minimum target not reached");
        }

        // Transfer all raised funds to issuer
        let contract_address = env.current_contract_address();
        token::Client::new(&env, &state.token).transfer(
            &contract_address,
            &state.issuer,
            &state.total_raised,
        );

        state.status = EscrowStatus::Released;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(offer_id), &state);
    }

    /// Investidor solicita reembolso (escrow expirado sem atingir meta).
    pub fn refund(env: Env, offer_id: String, investor: Address) {
        investor.require_auth();

        let mut state: EscrowState = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(offer_id.clone()))
            .expect("Escrow not found");

        // Allow refund if deadline passed and goal not met
        if state.status == EscrowStatus::Released {
            panic!("Escrow already released");
        }
        if env.ledger().timestamp() <= state.deadline && state.status == EscrowStatus::Active {
            panic!("Escrow deadline not passed yet");
        }

        let deposit_key = DataKey::Deposit(offer_id.clone(), investor.clone());
        let deposited: i128 = env
            .storage()
            .persistent()
            .get(&deposit_key)
            .expect("No deposit found");

        if deposited == 0 {
            panic!("Nothing to refund");
        }

        // Transfer back to investor
        let contract_address = env.current_contract_address();
        token::Client::new(&env, &state.token).transfer(
            &contract_address,
            &investor,
            &deposited,
        );

        // Zero out deposit
        env.storage().persistent().set(&deposit_key, &0i128);
        state.total_raised -= deposited;
        state.status = EscrowStatus::Expired;
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(offer_id), &state);
    }

    /// Consulta o estado atual do escrow de uma oferta.
    pub fn get_state(env: Env, offer_id: String) -> EscrowState {
        env.storage()
            .persistent()
            .get(&DataKey::Escrow(offer_id))
            .expect("Escrow not found")
    }

    /// Consulta o depósito de um investidor em uma oferta.
    pub fn get_deposit(env: Env, offer_id: String, investor: Address) -> i128 {
        let deposit_key = DataKey::Deposit(offer_id, investor);
        env.storage().persistent().get(&deposit_key).unwrap_or(0)
    }
}

mod test;
