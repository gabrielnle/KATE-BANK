#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

/// Dados de um vesting schedule individual
#[contracttype]
#[derive(Clone)]
pub struct Schedule {
    /// Endereço do token RWA sendo vestido
    pub token: Address,
    /// Quantidade total de tokens no vesting
    pub total_amount: i128,
    /// Quantidade já resgatada (claimed)
    pub claimed: i128,
    /// Timestamp Unix de início do vesting
    pub start_time: u64,
    /// Duração do cliff em segundos (ex: 6 meses = 15_552_000)
    pub cliff_duration: u64,
    /// Duração total do vesting em segundos (ex: 24 meses = 63_072_000)
    pub total_duration: u64,
    /// Se o vesting foi revogado pelo admin
    pub revoked: bool,
}

/// Chaves de storage
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Vesting schedule de um beneficiário
    Schedule(Address),
    /// Administrador do contrato
    Admin,
}

/// VestingSchedule — Contrato de desbloqueio gradual de tokens RWA.
///
/// Implementa vesting linear com cliff period para tokens de equity:
/// - Admin cria um schedule vinculando tokens a um beneficiário
/// - Tokens ficam bloqueados durante o cliff period (ex: 6 meses)
/// - Após o cliff, tokens são liberados linearmente até o fim do vesting
/// - Beneficiário faz `claim()` para resgatar os tokens disponíveis
///
/// Fórmula de cálculo:
///   vested = total_amount × (elapsed - cliff) / (total_duration - cliff)
///
/// Aplicação CVM 88: Garante que investidores de equity não liquidem
/// posições antes do período mínimo regulatório de lock-up.
#[contract]
pub struct VestingSchedule;

#[contractimpl]
impl VestingSchedule {
    /// Inicializa o contrato com o endereço do administrador.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Cria um novo vesting schedule para um beneficiário.
    ///
    /// O admin deve ter previamente transferido os tokens para este contrato.
    ///
    /// # Parâmetros
    /// - `beneficiary`: Endereço Stellar do investidor
    /// - `token`: Endereço SAC do token RWA
    /// - `total_amount`: Quantidade total de tokens a vestir
    /// - `cliff_duration`: Segundos até o primeiro desbloqueio
    /// - `total_duration`: Duração total do vesting em segundos
    pub fn create_schedule(
        env: Env,
        beneficiary: Address,
        token: Address,
        total_amount: i128,
        cliff_duration: u64,
        total_duration: u64,
    ) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if total_duration == 0 || cliff_duration > total_duration {
            panic!("Invalid vesting durations");
        }

        let schedule = Schedule {
            token,
            total_amount,
            claimed: 0,
            start_time: env.ledger().timestamp(),
            cliff_duration,
            total_duration,
            revoked: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Schedule(beneficiary), &schedule);
    }

    /// Calcula a quantidade de tokens já vestidos (desbloqueados).
    ///
    /// Retorna 0 se ainda estiver no período de cliff.
    /// Retorna total_amount se o vesting já terminou completamente.
    pub fn get_vested(env: Env, beneficiary: Address) -> i128 {
        let schedule: Schedule = env
            .storage()
            .persistent()
            .get(&DataKey::Schedule(beneficiary))
            .expect("No vesting schedule found");

        if schedule.revoked {
            return 0;
        }

        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(schedule.start_time);

        // Still in cliff period
        if elapsed < schedule.cliff_duration {
            return 0;
        }

        // Fully vested
        if elapsed >= schedule.total_duration {
            return schedule.total_amount;
        }

        // Linear vesting after cliff
        let vesting_elapsed = elapsed - schedule.cliff_duration;
        let vesting_period = schedule.total_duration - schedule.cliff_duration;

        (schedule.total_amount * vesting_elapsed as i128) / vesting_period as i128
    }

    /// Beneficiário resgata os tokens vestidos disponíveis.
    ///
    /// Calcula a diferença entre o total vestido e o já resgatado,
    /// e transfere essa diferença para o beneficiário.
    pub fn claim(env: Env, beneficiary: Address) -> i128 {
        beneficiary.require_auth();

        let mut schedule: Schedule = env
            .storage()
            .persistent()
            .get(&DataKey::Schedule(beneficiary.clone()))
            .expect("No vesting schedule found");

        if schedule.revoked {
            panic!("Vesting has been revoked");
        }

        let vested = Self::get_vested(env.clone(), beneficiary.clone());
        let claimable = vested - schedule.claimed;

        if claimable <= 0 {
            panic!("Nothing to claim yet");
        }

        // Transfer tokens from contract to beneficiary
        let contract_address = env.current_contract_address();
        token::Client::new(&env, &schedule.token).transfer(
            &contract_address,
            &beneficiary,
            &claimable,
        );

        schedule.claimed += claimable;
        env.storage()
            .persistent()
            .set(&DataKey::Schedule(beneficiary), &schedule);

        claimable
    }

    /// Admin revoga o vesting de um beneficiário (ex: fraude detectada).
    pub fn revoke(env: Env, beneficiary: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut schedule: Schedule = env
            .storage()
            .persistent()
            .get(&DataKey::Schedule(beneficiary.clone()))
            .expect("No vesting schedule found");

        schedule.revoked = true;
        env.storage()
            .persistent()
            .set(&DataKey::Schedule(beneficiary), &schedule);
    }

    /// Consulta o schedule completo de um beneficiário.
    pub fn get_schedule(env: Env, beneficiary: Address) -> Schedule {
        env.storage()
            .persistent()
            .get(&DataKey::Schedule(beneficiary))
            .expect("No vesting schedule found")
    }
}

mod test;
