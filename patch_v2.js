const fs = require('fs');
const file = 'kate-equity-crowdfunding/kate2/src/lib/trpc/routers/admin.ts';
let code = fs.readFileSync(file, 'utf8');

const search = `    // ⚡ Performance Optimization: Batch database updates in a transaction
    // Expected improvement: Reduces N database round-trips to 1 round-trip.
    if (settledData.length > 0) {
      const updates = settledData.map((data) =>
        ctx.prisma.reservation.update({
          where: { id: data.id },
          data:  { status: 'settled', blockchain_tx_hash: data.txHash },
        })
      )
      await ctx.prisma.$transaction(updates)
    }`;

const replace = `    // ⚡ Performance Optimization: Execute database updates concurrently
    // We cannot use an all-or-nothing $transaction because Stellar transfers
    // are irreversible. Using Promise.allSettled allows independent database
    // updates to execute concurrently without failing the whole batch.
    if (settledData.length > 0) {
      const updatePromises = settledData.map((data) =>
        ctx.prisma.reservation.update({
          where: { id: data.id },
          data:  { status: 'settled', blockchain_tx_hash: data.txHash },
        }).then(() => {
          results.success++
        }).catch((e: any) => {
          results.failed++
          results.errors.push(\`\${data.id} (DB Update): \${e.message}\`)
        })
      )
      await Promise.allSettled(updatePromises)
    }`;

if (code.includes(search)) {
  fs.writeFileSync(file, code.replace(search, replace));
  console.log("Replaced successfully (transaction block)!");
} else {
  console.log("Search string not found.");
}

const search2 = `        settledData.push({ id: reservation.id, txHash: result.txHash })
        results.success++`;

const replace2 = `        settledData.push({ id: reservation.id, txHash: result.txHash })`;

if (code.includes(search2)) {
  code = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, code.replace(search2, replace2));
  console.log("Replaced successfully (success count logic)!");
} else {
  console.log("Search string 2 not found.");
}
