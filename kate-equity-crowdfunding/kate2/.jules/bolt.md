## 2024-05-15 - DB Aggregation vs JS Reduce
**Learning:** Prisma `.reduce()` on included relations is an anti-pattern here because it pulls full datasets into Node.js memory. Prisma's `aggregate()` offloads the computation to the database, saving memory and network latency.
**Action:** Always prefer `prisma.reservation.aggregate({ _sum: { ... } })` over fetching arrays of records just to calculate sums, especially as platform usage grows.

## 2024-05-18 - Optimize asynchronous iterations
**Learning:** Sequential `await` in loops over independent items (like external network calls or database updates) introduces unnecessary latency proportional to the size of the array.
**Action:** When operating on arrays of independent elements with asynchronous operations, use `Array.prototype.map()` combined with `Promise.allSettled()` (or `Promise.all()`) to run these requests concurrently. This offloads the wait times to execute in parallel, yielding significant performance gains.
