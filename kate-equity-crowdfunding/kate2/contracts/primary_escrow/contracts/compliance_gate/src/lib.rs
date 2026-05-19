#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

/// Registro KYC de um endereço
#[contracttype]
#[derive(Clone)]
pub struct KycRecord {
    /// Se o endereço está aprovado
    pub approved: bool,
    /// Timestamp Unix de expiração da aprovação KYC
    pub expiry: u64,
    /// Nível de risco do investidor (1 = baixo, 3 = alto)
    pub risk_level: u32,
}

/// Chaves de storage
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Registro KYC de um endereço
    Kyc(Address),
    /// Administrador do contrato
    Admin,
    /// Total de endereços KYC-approved
    TotalApproved,
}

/// ComplianceGate — Contrato de verificação KYC on-chain (CVM 88).
///
/// Implementa um registro descentralizado de compliance que pode ser
/// consultado por outros contratos antes de aceitar transações:
///
/// - **Registro**: Admin aprova endereços após validação KYC off-chain
/// - **Consulta**: Contratos de escrow/vesting verificam compliance antes de operar
/// - **Expiração**: Aprovações KYC possuem validade temporal (ex: 365 dias)
/// - **Revogação**: Admin pode revogar compliance a qualquer momento
///
/// Este contrato serve como uma "whitelist descentralizada" que garante
/// que apenas investidores verificados possam participar de ofertas
/// reguladas pela CVM 88.
#[contract]
pub struct ComplianceGate;

#[contractimpl]
impl ComplianceGate {
    /// Inicializa o contrato com o endereço do administrador (plataforma).
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalApproved, &0u32);
    }

    /// Registra um endereço como KYC-approved.
    ///
    /// # Parâmetros
    /// - `address`: Endereço Stellar do investidor a ser aprovado
    /// - `expiry`: Timestamp Unix de expiração da aprovação
    /// - `risk_level`: Nível de risco (1 = baixo, 2 = médio, 3 = alto)
    pub fn register_kyc(env: Env, address: Address, expiry: u64, risk_level: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if risk_level < 1 || risk_level > 3 {
            panic!("Risk level must be 1, 2 or 3");
        }

        let record = KycRecord {
            approved: true,
            expiry,
            risk_level,
        };

        // Check if this is a new registration
        let is_new = !env.storage().persistent().has(&DataKey::Kyc(address.clone()));

        env.storage()
            .persistent()
            .set(&DataKey::Kyc(address), &record);

        if is_new {
            let total: u32 = env
                .storage()
                .instance()
                .get(&DataKey::TotalApproved)
                .unwrap_or(0);
            env.storage()
                .instance()
                .set(&DataKey::TotalApproved, &(total + 1));
        }
    }

    /// Revoga a aprovação KYC de um endereço.
    pub fn revoke_kyc(env: Env, address: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut record: KycRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Kyc(address.clone()))
            .expect("KYC record not found");

        record.approved = false;
        env.storage()
            .persistent()
            .set(&DataKey::Kyc(address), &record);
    }

    /// Verifica se um endereço está em compliance (KYC válido e não expirado).
    ///
    /// Retorna `true` se:
    /// - O endereço possui registro KYC
    /// - A aprovação está ativa (não revogada)
    /// - O timestamp atual é anterior à expiração
    pub fn is_compliant(env: Env, address: Address) -> bool {
        let record: Option<KycRecord> = env.storage().persistent().get(&DataKey::Kyc(address));

        match record {
            Some(r) => r.approved && env.ledger().timestamp() < r.expiry,
            None => false,
        }
    }

    /// Consulta o registro KYC completo de um endereço.
    pub fn get_kyc(env: Env, address: Address) -> KycRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Kyc(address))
            .expect("KYC record not found")
    }

    /// Retorna o total de endereços KYC-approved.
    pub fn total_approved(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalApproved)
            .unwrap_or(0)
    }
}

mod test;
