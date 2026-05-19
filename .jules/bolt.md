## 2024-05-16 - DB Filtering on included arrays
**Learning:** Prisma's 'include' allows filtering the returned relation arrays with 'where'. Fetching full relation arrays only to filter them in JavaScript using '.filter()' creates massive overhead on memory and database bandwidth.
**Action:** Use 'where' inside Prisma's 'include' whenever possible to push the filtering to the database.
## 2024-05-18 - Admin batch jobs database transaction optimization
**Learning:** Sequential processing loops like `for` loops in background or admin jobs often perform multiple database round-trips when updating records. Calling `prisma.model.update` repeatedly inside a loop is a classic N+1 query vulnerability that creates immense latency and database load.
**Action:** When updating database rows within a sequential process block (like token issuances that require strict sequence logic), aggregate the updated data items into an array in memory. After the sequential block, perform a single batched database update using `prisma.$transaction()` or `updateMany` to minimize network round trips and boost performance.
