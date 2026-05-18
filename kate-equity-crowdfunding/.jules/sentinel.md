## 2024-05-24 - Remove Hardcoded Stellar Secret Key
**Vulnerability:** A hardcoded Stellar secret key (`BANK_BRZ_SECRET`) was found in `src/lib/stellar/client.ts`.
**Learning:** Hardcoded secrets, even for Testnet/MVP simulations, pose a significant security risk if accidentally deployed or exposed.
**Prevention:** Always load secrets from environment variables (e.g., `process.env.SECRET_NAME`) and throw clear descriptive errors at initialization if they are missing, rather than relying on fallback strings.
