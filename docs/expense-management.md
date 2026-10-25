# Saved expense editing and deletion

The group owner can edit or delete any saved expense, including guest-submitted expenses, from the owner expense list. Guests continue to create and view expenses; management reads and mutations independently require the authenticated owner and their active owner GroupMember. Expense and member IDs are scoped to the group on the server.

## Editing

The edit route `/groups/[groupId]/expenses/[expenseId]/edit` reuses the expense details and review components. It loads the original description, amount, payer, participants and exact saved shares. Back/edit and review retain custom allocations. Changing the total does not redistribute shares. Newly selected participants start at zero; deselected participants are explicitly removed from the proposed allocation. The review shows assigned/remaining totals and blocks saving until every share is valid and the sum matches. Reset to equal uses the existing lowest-member-ID penny remainder rule.

Inactive members can remain in their historical roles (payer and/or participant), but cannot be newly selected in another role. Their saved allocations are retained. The server revalidates membership, positive GBP amounts, distinct participants and exact shares on save. Selected members are locked in deterministic ID order without reactivating inactive members.

## Deletion and repayments

The delete route identifies the expense and total and explains that balances will change. Cancel returns to the group without submitting. Confirmation soft-deletes the expense using `deletedAt`, retaining its shares and an identifying `EXPENSE_DELETED` activity event. The expense disappears from normal lists and calculations. Repeating a completed deletion returns safely without another event. Unknown or foreign expense IDs remain inaccessible.

Repayment records and statuses remain in history, but allocations belonging to the deleted expense are permanently excluded from confirmed balance effects and pending reservations. Other allocations remain effective. Each affected payment gets a `PAYMENT_ALLOCATION_EXCLUDED` activity record. A partially excluded report requires fresh owner review before confirming its remaining amount; a fully excluded report cannot be confirmed. No refund is suggested for the excluded amount.

Unassociated historical SENT or CONFIRMED payments block deletion until the owner explicitly reconciles their expense allocations in Payment history. Associations are never inferred. Financial edits also require reconciliation and cannot change a linked expense's payer, remove its payment sender from participants, or reduce their share below its confirmed/pending allocations without explicit resolution. Description-only edits remain possible. See [allocation design and migration requirements](payment-allocations.md).

## Consistency and refresh

`src/data/expense-management.ts` takes the existing GBP group-row lock before reading the saved expense and shares, and rechecks owner authentication after the wait using the same connection. Edit and delete coordinate with expense creation, payment writes and ledger reads. Expense changes, share replacement/removal and activity are one transaction. Editing preserves the Expense ID and original creation timestamp.

The allocation migration is required and is prepared but unapplied. A SHA-256 version of the persisted expense, ordered shares and latest expense audit-event ID detects stale edits and deletion confirmations. Including the audit revision also detects edits subsequently restored to their original values. All future expense mutation paths must follow the same lock and append-only activity convention. A duplicate edit is rejected as stale, with instructions to reopen the expense; it cannot produce another financial effect or event. Direct SQL writers that bypass this protocol are outside this guarantee.

Successful actions revalidate the owner group, guest group and dashboard, then return to the group with a success message. Financial reads use the full ledger, independently of the latest-50 expense display limit. Edit/delete events appear in guest activity as well as owner activity. Refreshing an edit route remounts its draft when the saved version changes, avoiding pairing old inputs with a fresh concurrency version.

## Verification limits and manual checks

Tests use isolated database and React doubles; they verify authorization, validation, rollback, serialized races, retained payments, complete-ledger dashboard results, actions and component markup. They do not establish real PostgreSQL lock contention or browser interaction. No live expenses or repayments were edited/deleted during implementation. See [dated verification](tests.md).

On a disposable development group, at mobile and desktop widths in both themes:

1. Open a custom-split expense as owner. Check exact shares, change details, review, go back and confirm that values survive. Cancel and verify nothing changed.
2. Change total/participants, resolve the displayed remainder, then save. Compare owner/guest group balances, activity and dashboard totals; repayment history must be unchanged.
3. Open the same expense in two tabs. Save in one; the older tab must refuse to overwrite or delete the newer version.
4. Open Delete, check the description/amount, cancel, then confirm deletion when intended. Verify the expense disappears, identifying activity remains and only its associated payment amounts are excluded. A fully settled single expense should leave both members even.
5. As a guest, verify create/view still work and owner management routes/actions are denied. Check keyboard navigation, visible errors, touch targets and absence of overflow.
