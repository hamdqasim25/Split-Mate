import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
// If the coordinator is interrupted, OS connection closure rolls back any
// unfinished transaction. A worker cannot outlive its bounded test operation.
const watchdog = setTimeout(() => process.exit(124), 25000);
watchdog.unref();
process.once("disconnect", () => process.exit(0));

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (specifier === "next/headers") return { url: new URL("./runtime.mjs", import.meta.url).href, shortCircuit: true };
    if (specifier === "@/prisma/db") return { url: new URL("./runtime.mjs", import.meta.url).href, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const url = new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url);
      if (!existsSync(url)) throw new Error("Integration service import not found.");
      return { url: url.href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const { db, pool, setCookies } = await import("./runtime.mjs");
const { claimMember } = await import("../../src/data/invites.ts");
const { createExpense } = await import("../../src/data/expenses.ts");
const { createPayment, reviewPayment } = await import("../../src/data/payments.ts");
const { getSavedExpenseForOwner, updateSavedExpense, deleteSavedExpense } = await import("../../src/data/expense-management.ts");
const { deleteGroupForOwner } = await import("../../src/data/group-deletion.ts");
const { getLedgerForGroup } = await import("../../src/data/balances.ts");
hooks.deregister();
const operations = { claimMember, createExpense, createPayment, reviewPayment, getSavedExpenseForOwner, updateSavedExpense, deleteSavedExpense, deleteGroupForOwner, getLedgerForGroup };
const { rows: [{ pid }] } = await pool.query("SELECT pg_backend_pid() AS pid");
process.send({ ready: true, pid });
process.once("message", async ({ operation, args, cookies: supplied }) => {
  setCookies(supplied);
  try {
    if (!Object.hasOwn(operations, operation)) throw new Error("Unknown integration operation");
    const value = await operations[operation](...args);
    process.send({ ok: true, value });
  } catch (error) {
    let current = error; let code;
    for (let depth = 0; depth < 8 && current; depth++, current = current.cause) {
      if (typeof current.code === "string" && /^[A-Z0-9_.-]{1,80}$/.test(current.code)) code = current.code;
    }
    const expected = ["InviteError", "ExpenseError", "PaymentError", "GroupDeletionError"];
    // Error subclasses currently inherit name=Error; use constructor identity.
    const name = error.constructor?.name;
    process.send({ ok: false, name, code, message: expected.includes(name) ? error.message : "Database operation failed." });
  } finally {
    await db.close(); await pool.end(); clearTimeout(watchdog); process.disconnect();
  }
});
