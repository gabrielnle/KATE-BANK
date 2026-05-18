## 2024-05-16 - DB Filtering on included arrays
**Learning:** Prisma's 'include' allows filtering the returned relation arrays with 'where'. Fetching full relation arrays only to filter them in JavaScript using '.filter()' creates massive overhead on memory and database bandwidth.
**Action:** Use 'where' inside Prisma's 'include' whenever possible to push the filtering to the database.

## 2025-05-18 - Optimize asynchronous iterations
**Learning:** Sequential awaits inside `for...of` loops for independent API calls (like adding documents or records) result in linear time scaling.
**Action:** Always replace sequential awaits for independent operations with `Promise.all` mapping to process operations concurrently, especially when interacting with external services or mutation endpoints, which can provide 4x+ speedups for batches.