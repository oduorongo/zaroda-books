# Architecture

## Why a monolith

One Next.js application does the UI, the API and the background work, deployed
as one Vercel project against one Postgres database. There is no separate
backend to run, no container to keep alive, and no second thing to pay for.
For a subscription product sold to schools, the operating cost at ten
customers has to be close to the cost at one, and this shape delivers that.

The one boundary that matters is inside the codebase, not between servers:

```
src/domain/     pure accounting engine — no next, no db, no react
     ↑
src/server/     the only writer; validates, persists, audits
     ↑
src/app/        routes: server components read, actions write
```

`src/domain/` has no imports outside itself. That is what lets ZARODA SMS
consume the same engine later without forking it, and what lets every
accounting rule be tested in milliseconds without a database.

## The layout

```
zaroda-books/
├─ CLAUDE.md               rules Claude Code reads every session
├─ ARCHITECTURE.md
├─ README.md
├─ drizzle.config.ts
├─ next.config.ts
├─ vitest.config.ts
├─ fixtures/               the original workbooks — golden master
└─ src/
   ├─ domain/
   │  ├─ money.ts          integer cents, formatting
   │  ├─ types.ts          Receipt | Payment | Contra
   │  ├─ validate.ts       invariants 1 and 2
   │  ├─ cash-book.ts      analysed cash book, both sides
   │  ├─ ledger.ts         cumulative Dr/Cr per vote head
   │  ├─ trial-balance.ts  year to date, with the balance check
   │  ├─ capitation.ts     per-learner split, exact to the cent
   │  ├─ vote-heads.ts     chart of accounts per account type
   │  └─ __tests__/
   ├─ db/
   │  ├─ schema.ts         Drizzle tables
   │  └─ index.ts          Neon client
   ├─ server/
   │  ├─ transactions.ts   createTransaction — the only write path
   │  └─ periods.ts        assertClosable — invariants 4 and 5
   ├─ demo/                sample data so the app runs with no database
   └─ app/
      ├─ layout.tsx, page.tsx, globals.css
      ├─ accounts/[accountId]/cash-book | ledger | trial-balance
      └─ api/transactions/route.ts
```

## Data model

`orgs → schools → accounts → vote_heads`, and
`financial_years → periods → transactions → allocations`.

An org is a firm or a school group, which is how one freelance accountant holds
thirty schools under a single login. Every query scopes by `org_id`; that is the
tenancy boundary and it must be applied in `src/server/`, never trusted from the
client.

`transactions` and `allocations` are the only financial facts stored. Balances
appear in `periods` exactly once, when a month closes, and are frozen from then
on. If you find yourself adding a `balance` column anywhere else, stop.

## Build order

1. **Wire the database.** Neon on Vercel, `db:generate`, `db:migrate`, seed one
   org, one school, one account, and its vote heads from `CHART_OF_ACCOUNTS`.
2. **Fixture replay.** Load a real workbook from `fixtures/` and assert the
   engine reproduces its monthly trial balances. Several months in the boarding
   workbook do not balance — record which, and why, in the test.
3. **Auth and tenancy.** Email and password, sessions, `org_id` scoping applied
   in one place.
4. **Transaction entry.** Finish `createTransaction`: insert the transaction,
   its allocations and an audit row in a single database transaction.
5. **Period close.** `assertClosable`, then freeze and carry forward.
6. **Capitation wizard.** Enter the disbursement and the term's enrolment, and
   the split posts as one receipt with its allocations.
7. **Bank reconciliation.** Absent from all six workbooks and required monthly.
   Highest-value thing the software adds that the spreadsheets never did.
8. **Exports.** Cash book, ledger, trial balance, receipts and payments,
   income and expenditure, as PDF and Excel.

## Things deliberately left out for now

Stores ledgers (S11/S12/S13), asset register, imprest and petty cash, per
student fees and arrears, procurement documents. Each is a clean addition on
top of this model; none of them should change it.
