# ZARODA BOOKS

Books of accounts for Kenyan schools — analysed cash book, ledger, trial
balance and capitation allocation, for the SIMBA, GPA, Operations, Tuition,
Infrastructure and Boarding vote accounts.

One Next.js application, one database, one Vercel project.

## Run it

```
npm install
npm run dev
```

Open http://localhost:3000. The reports render from sample data in
`src/demo/`, so the app works before any database exists.

```
npm test        # engine tests, including two real trial balances
npm run typecheck
npm run build
```

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. On vercel.com, **Add New > Project**, and import that repository. Next.js is
   detected automatically — accept the defaults and deploy.
3. Add a database: in the project, **Storage > Create Database > Neon**. Vercel
   sets `DATABASE_URL` for you.
4. Add `AUTH_SECRET` under **Settings > Environment Variables**. Generate one
   with `openssl rand -base64 32`.
5. Create the tables: `npm run db:generate` then `npm run db:migrate`, with
   `DATABASE_URL` in a local `.env` file copied from `.env.example`.

Every push to `main` redeploys. Pull requests get their own preview URL.

## Where to start

Read `CLAUDE.md` for the accounting rules, then `ARCHITECTURE.md` for the build
order. The engine in `src/domain/` is the product; everything else is a window
onto it.
