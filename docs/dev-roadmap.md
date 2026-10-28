# SPLITMate roadmap

This is the single source for feature status, known limitations and future work. "Implemented" means the code and relevant automated coverage exist; it does not imply every live-database or browser scenario has been verified. See [testing evidence](tests.md) for that distinction.

The product principle remains: only the owner needs an account. Guests should be able to open an invitation, choose their existing name and participate with minimal friction. Financial history belongs to their group membership, whether or not they later create an account.

## Implemented capabilities

| Capability | What people can do |
| --- | --- |
| Owner accounts | Register, sign in and sign out through separate, hashed, database-backed owner sessions |
| Group creation and dashboard | Create GBP groups with named guests, receive an owner membership and secure share link, and see persisted groups with separate owed/owing totals |
| Guest participation | Claim an eligible existing name without registering; return through a protected group page using a hashed guest session; sign out on the device |
| Group information | View active members, joined/waiting states, recent activity and saved expense shares |
| Expense creation | Choose who paid and participated, review deterministic equal or custom shares and save all records together |
| Balances | See complete-ledger balances, effective confirmed repayment effects, historical inactive members and explicit unavailable states when records cannot be reconciled |
| Repayments | Guests report their own external transfers; owners confirm/reject or directly record completed payments, including between other members |
| Retry-safe payments | Reuse a payment request key after an uncertain result; reserve pending debt/credit and avoid duplicate review effects |
| Retry-safe expenses | Retain one request key through review and retries; matching requests return the original expense even after edits/deletion, while conflicting reuse is rejected; application migration applied on 27 October and independently verified on 28 October 2026 |
| Expense associations and reconciliation | Allocate repayments to expenses, review historical associations from evidence and retain exclusion history |
| Saved expense management | Owners edit any expense with stale-form protection or soft-delete it while retaining history and excluding only its linked payment allocations |
| Permanent group deletion | Owners explicitly confirm removal of the group and dependent history/access while preserving other groups and accounts |
| Appearance | Shared light/dark preference, compact member cards, expandable breakdowns and a native 44px theme control |
| PostgreSQL integration verification | Reproduce competing claims, expense retries, payment reservations, deletion races and failed-write rollback on an isolated local database; 26 real-database cases passed on 25 October 2026 |

The configured Prisma-hosted application database now includes the expense-request migration, with fresh status, schema and full marker verification. The website itself is local-only, as confirmed by the user; hosted verification is not applicable. Environment-specific evidence belongs in [database design](database-design.md#reported-migration-state); it is not a claim that all environments are ready.

## Agreed immediate priorities and deployment gates

These priorities carry forward the existing roadmap; no delivery dates are committed. Idempotency means that retrying one request has the same effect as sending it once. Concurrency means requests happening at the same time; rollback means undoing every part of a failed transaction. Rate limiting restricts how often an action can be attempted.

| Work | User benefit | What completion means |
| --- | --- | --- |
| Verify expense retry protection in the browser | Confirm recovery from an uncertain save in the actual owner/guest interface | Database deployment and separate-connection concurrency checks are complete; the user will verify local browser review/back/edit, validation, committed-response loss/retry, conflicting reuse and fresh keys |
| Rate limiting before public deployment | Reduce abusive login, registration and claim attempts | Define and implement server-side attempt limits and useful retry feedback, then verify that protection cannot be bypassed through ordinary endpoint access |
| Complete deployment/browser verification | People can rely on the intended flows on phones and desktops | Verify each target environment's schema and execute the outstanding owner/guest, deletion, reconciliation, cookie and accessibility checks in tests.md; do not treat one working form as proof of every flow |

## Known limitations

| Limitation | Current consequence |
| --- | --- |
| Group creation lacks durable retry identities | Separate successful requests can create duplicate groups after a lost response |
| One guest identity per browser; no recovery or identity-switching interface | Signing out, losing or expiring a guest cookie leaves the member claimed without a recovery flow |
| Historical payments may not fit expense-association rules | Unresolved confirmed payments make balances unavailable; pending/confirmed unassociated payments block deletion and financial edits; old netted transfers or permanently removed expenses need a separately reviewed recovery approach |
| GBP only, equal/custom splitting | Percentage splits, other currencies and exchange-rate conversion are unavailable |
| Owner review is the current payment authority | Guest recipients cannot confirm; terminal payment statuses cannot be reversed |
| No restoration for deleted expenses; permanent group deletion removes history | These are deliberate current deletion semantics, not an archive or refund mechanism |
| No live push updates | Another open browser must refresh after changes |
| Complete-ledger reads grow with history | Financial reads use a group lock and memory proportional to history; dashboard groups are not one simultaneous snapshot |
| Automated evidence has a defined scope | 663 isolated tests and 26 local PostgreSQL cases passed at the recorded checkpoint; application schema/marker verification also passes, but full HTTP/browser journeys, production cookies and broad accessibility checks remain unverified. Hosted checks are not applicable to the current local-only website |

## Future work without assigned priority

These are retained proposals, not scheduled commitments. Product and security decisions are needed before implementation where noted.

| Proposal | User benefit | What completion would mean |
| --- | --- | --- |
| Group-creation retry safety | Avoid duplicate groups after an uncertain submission | Persist an intent key with payload matching and prove retries return one group/member/event set; group names must not be used as keys |
| Guest session recovery and multiple-group access | Return to a claimed identity and use several groups without losing access | An explicitly designed identity-verification/recovery flow, safe per-group session selection and tests that prevent impersonation |
| Optional account linking | Keep all participating groups accessible through an account | Link the verified existing GroupMember to the account without duplicating membership or moving financial records; retain Skip/guest participation |
| Member management | Let owners maintain the group roster | Owner-authorized add/deactivate controls, duplicate-name policy, activity and same-group checks, while preserving historical records |
| Invitation disable/regeneration controls | Let owners stop new claims or replace a shared URL | Owner-only controls enforce existing access policy, invalidate old tokens on regeneration and explain effects on existing guests |
| Percentage splitting | Divide expenses by agreed proportions | Define percentage validation and penny allocation; shares always sum exactly to the total through review and persistence |
| Settlement suggestions | Help members see who could pay whom | Define a deterministic suggestion policy compatible with existing expense allocations; suggestions must not move money or mark it paid |
| Broader payment lifecycle controls | Resolve mistakes beyond current rejection/reconciliation | Agree cancellation/reversal permissions and audit/balance effects first, then verify each approved transition |
| Historical-payment recovery | Resolve records that cannot satisfy current association rules | Investigate actual histories and approve an explicit recovery procedure without inventing expenses or changing transfers silently |
| Notifications | Help people notice relevant changes | Agree events, channels and preferences before implementation; protect private group information |

## Unprioritised ideas

Earlier planning also proposed expense categories, receipt/image attachments, comments or notes, payment-method labels, and multiple currencies/exchange rates. Preserve these as ideas for later discussion. Their scope, acceptance criteria and priority have not been agreed. A `/groups` index is not currently present; it is not an agreed requirement merely because older notes mentioned it.

## Maintaining this roadmap

When a feature is delivered, update its status here and remove the corresponding limitation only when resolved. Explain the user benefit and acceptance criteria for newly agreed work. Keep detailed behaviour in [architecture](architecture.md), database procedures in [database design](database-design.md), and evidence in [tests](tests.md). Do not recreate a second progress report or add delivery dates without agreement.
