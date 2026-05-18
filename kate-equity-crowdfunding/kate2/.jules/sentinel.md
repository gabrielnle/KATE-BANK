## 2024-05-18 - Prevent User Self-Certification of Investor Type
**Vulnerability:** A business logic flaw existed in the `upsertProfile` tRPC mutation where the input schema allowed users to arbitrarily pass `investor_type` (e.g., 'qualified' or 'professional'). This allowed users to self-certify and bypass CVM 88 regulatory investment limits.
**Learning:** Security controls on business logic boundaries must not trust user-supplied inputs for fields that determine access rights or financial limits.
**Prevention:** Never include sensitive status fields in public/protected user-facing mutation inputs. Always use server-side queries to fetch existing status/state or handle sensitive state changes exclusively via `adminProcedure` endpoints.
