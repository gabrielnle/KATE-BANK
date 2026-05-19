## 2024-05-16 - DB Filtering on included arrays
**Learning:** Prisma's 'include' allows filtering the returned relation arrays with 'where'. Fetching full relation arrays only to filter them in JavaScript using '.filter()' creates massive overhead on memory and database bandwidth.
**Action:** Use 'where' inside Prisma's 'include' whenever possible to push the filtering to the database.
## 2026-05-18 - Mocks Types with Bun Test
**Learning:** When writing tests that mock dependencies using `bun:test`, be careful to cast mock return values appropriately or type generic mocks to avoid TypeScript `any` errors or `@ts-ignore` which linting rules might flag. Avoid committing dynamically generated lockfiles (`pnpm-lock.yaml`) when network requests inside `pnpm install` resolve differently than CI.
**Action:** Use typed options and proper `as unknown as ReturnType<...>` to satisfy type checking during tests while adhering to strict lint configurations, and carefully review `git diff main` before committing.
