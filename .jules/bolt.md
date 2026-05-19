## 2024-05-18 - Offload wallet creation retry mechanism
**Learning:** Wallet creation may fail during user registration due to third-party APIs (Stellar Friendbot) rate limits or other transient errors.
**Action:** When a critical but non-blocking dependency (like a third-party wallet creation) fails during onboarding, implement a retry mechanism either as a user action or an admin action to prevent the user from being stuck in a broken state without manual intervention.
