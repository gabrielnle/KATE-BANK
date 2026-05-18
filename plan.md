1.  **Refactor `upsertProfile` in `src/lib/trpc/routers/investors.ts`:**
    *   Remove `investor_type` from the input validation (`z.object({...})`).
    *   Hardcode or assume `investor_type` is `'retail'` (or the existing type from the DB if updating).
    *   Calculate the `annual_limit` based strictly on retail investor logic (max R$ 20k if active, or 10% of income/investments, min R$ 3k).

2.  **Add `updateInvestorStatus` in `src/lib/trpc/routers/investors.ts` (or `admin.ts`):**
    *   Create an `adminProcedure` mutation.
    *   Input schema: `user_id: z.string()`, `investor_type: z.enum(['retail', 'qualified', 'professional', 'lead'])`.
    *   Update the `investorProfile` for the target user. If they are upgraded to qualified/professional, set `annual_limit` to `null` (no limit). If downgraded, recalculate the limit.
    *   Since I'll place it in `admin.ts` (which is typically for admin actions), I'll make sure it correctly finds the profile.

3.  **Complete pre-commit steps:**
    *   Call `pre_commit_instructions` tool to make sure proper testing, verifications, reviews and reflections are done.

4.  **Submit the change:**
    *   Use the `submit` tool to create a PR.
