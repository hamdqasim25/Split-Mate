import "server-only";

// Never serialize an exception, message, stack, query, constraint detail or
// request context: PostgreSQL/Prisma can embed credentials and row values there.
// Only literal allowlisted codes and application-owned labels reach the log.
const diagnoses: Record<string, string> = {
  "42703": "missing_column",
  "42P01": "missing_table",
  "23502": "not_null_constraint",
  "23503": "foreign_key_constraint",
  "23505": "unique_constraint",
  "23514": "check_constraint",
  "40001": "transaction_serialization_failure",
  "40P01": "transaction_deadlock",
  "55P03": "lock_unavailable",
  "57014": "query_cancelled_or_timed_out",
  "25P02": "transaction_already_failed",
  "25006": "read_only_transaction",
  "42501": "database_permission_denied",
  "28P01": "database_authentication_failed",
  "08001": "connection_failed",
  "08006": "connection_failed",
  "53300": "connection_limit",
  ECONNREFUSED: "connection_failed",
  ECONNRESET: "connection_failed",
  ENOTFOUND: "connection_failed",
  ETIMEDOUT: "connection_timeout",
  "DRIVER.CONNECTION_FAILED": "connection_failed",
  "CONTRACT.MARKER_MISMATCH": "database_contract_mismatch",
  "CONTRACT.MARKER_MISSING": "database_marker_missing",
  "CONTRACT.SCHEMA_VERIFICATION_FAILED": "database_schema_mismatch",
  "PLAN.HASH_MISMATCH": "generated_plan_contract_mismatch",
  "PN-RUN-3002": "database_contract_mismatch",
  "BUDGET.TIME_EXCEEDED": "runtime_time_budget",
  "BUDGET.ROWS_EXCEEDED": "runtime_row_budget",
  "RUNTIME.ABORTED": "runtime_aborted",
};
const kinds = new Set(["Error", "TypeError", "RangeError", "RuntimeError", "SqlQueryError", "SqlConnectionError"]);

function property(value: object, key: string): unknown {
  // Do not invoke custom getters or toJSON while trying to log a failure.
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

export function paymentErrorDiagnostic(error: unknown) {
  const codes = new Set<string>();
  const errorKinds = new Set<string>();
  const seen = new Set<object>();
  const queue = [{ value: error, depth: 0 }];
  while (queue.length && seen.size < 24) {
    const { value, depth } = queue.shift()!;
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    if (value instanceof TypeError) errorKinds.add("TypeError");
    else if (value instanceof RangeError) errorKinds.add("RangeError");
    else if (value instanceof Error) errorKinds.add("Error");
    const name = property(value, "name");
    if (typeof name === "string" && kinds.has(name)) errorKinds.add(name);
    for (const key of ["code", "sqlState"]) {
      const code = property(value, key);
      if (typeof code === "string" && Object.hasOwn(diagnoses, code)) codes.add(code);
    }
    if (depth < 4) for (const key of ["cause", "error", "originalError", "meta", "details"]) {
      queue.push({ value: property(value, key), depth: depth + 1 });
    }
  }
  return {
    kinds: [...errorKinds],
    codes: [...codes],
    diagnoses: codes.size ? [...new Set([...codes].map(code => diagnoses[code]))] : ["unclassified_error"],
  };
}

export function logPaymentFailure(operation: "submit" | "review", phase: "input" | "transaction" | "refresh", error: unknown) {
  console.error("Payment operation failed.", {
    // A transaction error may mean the commit acknowledgement was lost. False
    // means unacknowledged, not proof that no payment was persisted.
    operation, phase, commitAcknowledged: phase === "refresh", ...paymentErrorDiagnostic(error),
  });
}
