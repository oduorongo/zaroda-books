# ZARODA BOOKS

School books of accounts for Kenyan primary, junior and senior schools.
Users: school bursars, heads of institution, and freelance accountants who
keep books for many schools. Sold on annual subscription. The same engine
becomes the finance module of ZARODA SMS.

## Non-negotiable accounting rules

1. Only `transactions` and `allocations` are stored. The cash book, ledger,
   trial balance and income & expenditure are ALWAYS derived at read time.
   Never store a computed balance except in a period-close snapshot.
2. For a receipt or a payment, `sum(allocations)` MUST equal `cash + bank`.
   Reject the save otherwise.
3. A contra (cash to bank, cash from bank) moves money between cash and bank
   only. It never touches a vote head and never enters income or expenditure.
   It is a separate variant in the type union with no `allocations` field, so
   this cannot be violated by accident. Keep it that way.
4. A period cannot close while the trial balance is out of balance. Show the
   difference and the suspect entries instead.
5. Closing a period computes balance carried down, writes it as the next
   period's balance brought down, and freezes both. Reopening needs a reason
   and is written to `audit_log`.
6. All money is integer cents in a `bigint` column. Never a float, never a
   `numeric` read into a JS number.
7. For a capitation receipt, enrolment is not known in advance — the school
   derives it from the disbursement and the circular's per-learner rates in
   force, then that figure is stored on the receipt as fact (never
   recomputed later if rates change). The residue after rounding falls to
   the basic/residual vote head so the split equals the disbursement to the
   cent. Posting a capitation receipt also produces an acknowledgement
   record (enrolment used, per-head split) suitable for returning to the
   Ministry.
8. The financial year runs 1 July to 30 June.
9. Ledger convention, taken from the source workbooks: a receipt allocated to
   a vote head credits it, a payment debits it, so an unspent vote carries a
   credit balance.

## Where things live

- `src/domain/` — the accounting engine. Pure functions over plain data. It
  imports nothing from `next`, the database, or React, so ZARODA SMS can reuse
  it and so every rule is testable without a server. Keep it that way.
- `src/db/` — Drizzle schema and the Neon client.
- `src/server/` — the only place that writes. Validation runs here, in the same
  call as the insert.
- `src/app/` — routes. Server components read; server actions and route
  handlers write through `src/server/`.
- `fixtures/` — the original workbooks. Golden master for the engine tests.

## How I work

- I am not fluent in the terminal (Windows / PowerShell). Give me exact commands
  to paste, one at a time, and say what each one does before I run it.
- Keep code minimal. No decorative comments, no defensive layers I did not ask
  for. A comment should say why, not what.
- Ask before adding a dependency.
- Start in plan mode. Show me the plan before you write files.
- Write the failing test first for anything in `src/domain/`.
