# User Stories

## Implementation and testing notes — 17 September 2026

These stories were added during implementation and testing to clarify the guest-member experience. The original stories remain separately below. Status describes implemented behaviour, not just available database fields.

### Owner creates a group

As an authenticated owner, I want to name a group and enter my friends' names so we can start tracking shared costs.

**Implemented backend:** one transaction creates the group, secure share token, my claimed owner identity, guest identities and the group-created event.

**Pending:** owner authentication, submitting the form, showing the persisted group on my dashboard and testing this complete flow against a test database.

### Guest joins without registering

As a guest, I want to open the shared group link and select my existing name so I can participate without creating an account.

**Status:** planned. GroupMember, share-token and GuestSession storage exist; route, claiming and session behaviour remain to be implemented.

### Members can distinguish identities

As a group owner, I want clear feedback for blank or duplicate names so members can identify themselves reliably.

**Status:** backend validation implemented and unit tested. Duplicate names, including the owner's name, are rejected; distinguish people with the same name using an initial. Form feedback remains pending.

### Member records and settles expenses

As a group member, I want expenses and repayments attached to my group identity so my history works even without an account.

As a receiver, I want to confirm a repayment after the sender marks it sent so balances reflect payments I have received.

**Status:** supported by the database design; expense creation, splitting, balances and payment actions remain planned.

### Member sees a transparent history

As a group member, I want to see who changed the group and when so I can understand its records.

**Status:** GROUP_CREATED is written by the backend service. The activity feed and other action types remain pending.

### Guest optionally creates an account

As a guest, I want to link an account to my existing group identity later so I can collect my groups without duplicating financial history.

**Status:** planned. Accounts remain optional for guests.

The completed unit tests exercise backend rules using a database double. They do not demonstrate a working browser journey yet. See [group creation](group-creation.md) and [the roadmap](dev-roadmap.md).

---

## Original notes — preserved

The following notes are retained as originally written. For current implementation status, use the dated update above.


## Group Management

As a user,
I want to create a group,
so that I can manage shared expenses with my friends.

## Adding Expenses

As a group member,
I want to record an expense,
so that everyone knows how much they owe.

## Balance Tracking

As a user,
I want to see my current balance,
so that I know whether I owe money or am owed money.

## Settlement

As a group member,
I want the application to calculate who should pay whom,
so that the group can settle expenses efficiently.
