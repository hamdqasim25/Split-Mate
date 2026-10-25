# Expense-associated repayments

Payments previously referenced only sender/recipient GroupMembers. They did not identify expenses, so deleting an expense could leave its repayments reversing the apparent debt. New payments require explicit allocations to one or more expenses, recorded in integer pence. No amount/date/name matching is used.

## Associations and financial effects

Guest reporting and owner direct recording show expense amount fields. Select expenses paid by the recipient and shared by the sender; allocated amounts must exactly equal the payment. Same-group identities, active-member rules, global debt/credit capacity, per-expense shares and pending reservations are validated on the server. Up to 500 allocations are supported per payment. Financial histories are complete, independently of display limits.

Expense deletion sets `deletedAt`, keeps the original expense/shares and payment records, and writes deletion/exclusion activity in the existing group-lock transaction. An allocation to a deleted expense is permanently excluded from balances and pending reservations. A multi-expense payment retains the balance effect of its other allocations. History displays the original amount, allocation details and exclusion reason. There is no restoration path.

Confirmed balances use expenses paid minus shares plus effective confirmed payments sent minus received. Pending and rejected payments do not change balances. A partially excluded pending report needs a fresh allocation-version review before confirming its remaining portion; an entirely excluded report cannot be confirmed. Retries retain the request key and compare original allocations. Excluded amounts cannot be moved through reconciliation or revived by stale confirmation. Owner/guest group views and dashboard paths are refreshed after mutations.

## Historical reconciliation and edits

Historical payments receive no automatic allocations. An unresolved confirmed payment makes the whole group balance unavailable rather than displaying a partial total. Unresolved pending reports retain their reservation. Unresolved pending/confirmed payments block deletion and financial expense edits because their effects cannot safely be attributed. Rejected payments do not block those operations.

The owner opens Reconcile/Review associations in Payment history, enters verified allocations and explicitly confirms them. Payment amount, sender, recipient and status remain unchanged. The owner can correct active associations; previous/new associations are recorded in activity. Already excluded allocations are frozen. A version containing the reconciliation audit revision rejects stale updates, including changes later restored to their original values. Historical reconciliation permits known overpayments rather than altering the original transfer.

Reconciliation requires existing expenses paid by the recipient and shared by the sender. Some old netted transfers, or payments for expenses previously hard-deleted, may not satisfy this relationship. Those remain unresolved and need investigation and a separately reviewed recovery approach; do not invent expenses or associations to bypass the blocker. This release does not automatically recover such history.

Saved-expense edits cannot invalidate active pending/confirmed associations by changing payer, removing the sender as participant, or reducing a share below allocated amounts. Resolve the associations explicitly first, only when supported by the actual history. No automatic reassignment is performed. Rejected associations remain audit records without financial effect.

## Migration and deployment

Prepared migration: `migrations/app/20261022T2235_expense_payment_allocations/`. It adds a PaymentAllocation table with integer-pence BigInt amounts, payment/expense foreign keys, unique pair and indexes, plus nullable Expense.deletedAt. The seven operations are additive. Existing rows are preserved, with no guessed backfill. The pinned contract emitter generated the JSON/types and snapshot; offline migration check passed.

The migration has **not been applied** and the live schema has **not been verified** for this change. The updated generated contract requires the new schema. Before starting this code against an environment, securely load its administrative DIRECT_URL without printing it, inspect status and the complete preview, and obtain explicit deployment approval:

```powershell
npx.cmd --no-install prisma migration status --db "$env:DIRECT_URL"
npx.cmd --no-install prisma db migrate --show --to 20261022T2235_expense_payment_allocations --db "$env:DIRECT_URL"
```

Only after approval and a matching safe preview:

```powershell
npx.cmd --no-install prisma db migrate --to 20261022T2235_expense_payment_allocations --db "$env:DIRECT_URL"
npx.cmd --no-install prisma migration status --db "$env:DIRECT_URL"
npx.cmd --no-install prisma db verify --schema-only --db "$env:DIRECT_URL"
```

An empty DIRECT_URL is not an acceptable target: resolve environment configuration before running these commands. Do not reset a database, modify applied migrations or mark this migration applied manually. Review any prerequisite migrations separately. Schedule deployment for schema locks; restart the development server afterward to load the generated contract. Review historical reconciliation needs before exposing unavailable balances to users.

## Verification and manual checklist

### Payment form reset fix — 25 October 2026

The £5.00 reproduction was traced with isolated transaction/React doubles. Allocating `5`, `5.0` or `5.00` succeeds and stores exactly 500 pence. After the server returns success, PaymentForm clears its total to the empty string and rotates its request key. The hidden form still renders PaymentAllocationFields. Previously that render called `splitTotals("", ...)`, whose unguarded total parser threw the reported RangeError. The test verified that the confirmed payment, allocation and activity already existed before the reset render failed. This establishes the code path, not the status of any particular live payment. Clearing the total or typing an intermediate value such as `5.` could also throw during rendering.

PaymentAllocationFields now catches expected draft parsing errors at the rendering boundary, preserves raw input, marks invalid allocations with associated inline messages and shows unavailable totals rather than misleading partial sums. Empty allocation fields remain optional and are omitted. Payment totals and nonempty allocations still pass the unchanged strict server parser; invalid submissions are never coerced to zero. Totals use integer pence and must match exactly.

Existing request-key handling is unchanged: errors retain the same request, and acknowledged success resets the form and rotates the key. Regression tests also simulate a refresh failure after commit, then retry the same request and verify that only one payment/allocation/activity exists. Check payment history before creating a fresh report after an old crash, since the original payment may already have committed.

The 24 new regression cases cover accepted numeric text, clearing/editing payment and allocation inputs, unused blanks, invalid submissions, exact under/over-allocation, successful reset and idempotent retry. All 609 tests, lint, TypeScript and production build pass. Browser interaction remains unverified; tests render both parent and child components through React doubles. No live financial records were accessed or modified for this fix.

Tests use isolated database/React doubles, including rollback and serialized confirmation/deletion races; they do not prove real PostgreSQL contention or browser behaviour. No live financial records were created or changed. See [dated check results](tests.md).

After migration in an approved test environment:

1. Report a partial payment with explicit allocations as a guest; verify pending does not alter balances, input survives errors, and owner confirmation updates owner/guest/dashboard totals.
2. Settle a single expense completely, delete it as owner and check both members are even. History must retain the payment with its excluded amount and reason.
3. Allocate one payment across two expenses. Delete one and check only its amount is excluded; the other expense/allocation remains effective.
4. Delete an expense covered by a pending report. A fully excluded report cannot be confirmed; a partial report requires fresh review of its remaining amount. Retry an old form and verify no resurrection or duplicate.
5. Reconcile a historical payment using real evidence; check deletion was blocked beforehand and works afterward. Check stale reconciliation/edit tabs are refused and invalid payer/participant changes explain the required resolution.
6. Check mobile/desktop forms, keyboard focus, disclosures, long names, large amounts and light/dark themes. Compare individual group balances with the separate dashboard owed/owing totals.
