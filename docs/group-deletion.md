# Owner-only group deletion

Implemented on the owner group page: a compact 44px trash button opens a native modal naming the group and warning that expenses, repayments, activity and member access are permanently removed. Cancel receives focus first. The native dialog confines focus; Escape cancels when idle and closing returns focus to the trigger. Semantic theme colors support light/dark mode, and the dialog fits narrow screens. Delete shows progress, disables both actions and blocks rapid duplicate submissions. Errors remain visible in an alert and allow retry.

`src/app/actions/group-deletion.ts` requires explicit form confirmation. `src/data/group-deletion.ts` validates the ID and resolves the authenticated UserSession on the transaction connection. A conditional no-op `Group.updateAll` checks `createdBy` and acquires the same group-row lock as expense writes, repayments and guest claims. It works for any currency and disabled share links. Authentication is rechecked after waiting for the lock. Guest credentials and a GroupMember OWNER role alone never authorize deletion.

Inside that transaction, explicit scoped deletes remove GuestSession, PaymentAllocation, ExpenseParticipant, Payment, Expense, ActivityEvent and GroupMember rows before the Group. Cleanup includes inactive members, soft-deleted expenses and all repayment states. Any failure rolls back the transaction. User and UserSession rows and other groups are preserved. No deletion activity is retained because this operation intentionally removes the entire group's history. Repeated or competing deletion requests return an unavailable error after the first successful deletion.

Removing the group invalidates its share token; removing its guest sessions revokes existing credentials. Cookies on other devices cannot be erased remotely but no longer authenticate. After commit, the server action invalidates the owner and shared route trees plus `/dashboard`, then redirects to the dashboard, where totals are recalculated from remaining groups.

No schema or migration change was introduced. This implementation includes the existing PaymentAllocation model and therefore shares the application's existing prerequisite: the prepared `20261022T2235_expense_payment_allocations` migration must be reviewed/applied separately before deployment. No migration or live deletion was run for this feature.

## Verification

`tests/group-deletion.test.mjs` covers owner-only access, guest/anonymous/expired sessions, forged membership roles, invalid IDs, session revocation during lock acquisition, ordered locking, rollback at every deletion stage, other-group/account preservation, complete cleanup, revoked invitations/sessions, dashboard totals, duplicate requests, action confirmation/cache refresh/redirect, safe errors, dialog controls and pending/retry states. Tests use in-memory transaction and React doubles, not live PostgreSQL or a browser.

Before deployment, use a separate disposable test database to check real PostgreSQL foreign keys and contention with expense/payment writes and guest claims. In a browser, check mobile and desktop in both themes: long group names, keyboard focus confinement/restoration, Cancel/Escape, pending/error feedback and successful dashboard navigation. Never use live groups for deletion testing.
