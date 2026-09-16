import {
  pgTable, uuid, text, integer, bigint, date, timestamp, boolean, unique, index,
} from "drizzle-orm/pg-core";

/** A firm or a school group. Freelance accountants get one org, many schools. */
export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: text("role", { enum: ["owner", "accountant", "bursar", "viewer"] }).notNull(),
}, (t) => [unique().on(t.orgId, t.userId)]);

export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  name: text("name").notNull(),
  level: text("level", { enum: ["primary", "junior", "senior"] }).notNull(),
  county: text("county"),
  subCounty: text("sub_county"),
  nemisCode: text("nemis_code"),
}, (t) => [index("schools_org_idx").on(t.orgId)]);

/** One row per bank account / vote book: SIMBA, GPA, Operations, Boarding... */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").references(() => schools.id).notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  bankName: text("bank_name"),
  bankAccountNo: text("bank_account_no"),
});

export const voteHeads = pgTable("vote_heads", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id).notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  active: boolean("active").default(true).notNull(),
}, (t) => [unique().on(t.accountId, t.code)]);

export const financialYears = pgTable("financial_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id).notNull(),
  label: text("label").notNull(),          // "2025/26"
  startsOn: date("starts_on").notNull(),   // 1 July
  endsOn: date("ends_on").notNull(),       // 30 June
  openingCash: bigint("opening_cash", { mode: "number" }).notNull().default(0),
  openingBank: bigint("opening_bank", { mode: "number" }).notNull().default(0),
});

/** The circular's rate per learner, per vote head, for one financial year. */
export const voteHeadRates = pgTable("vote_head_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  financialYearId: uuid("financial_year_id").references(() => financialYears.id).notNull(),
  voteHeadId: uuid("vote_head_id").references(() => voteHeads.id).notNull(),
  perLearner: bigint("per_learner", { mode: "number" }).notNull(),
}, (t) => [unique().on(t.financialYearId, t.voteHeadId)]);

export const periods = pgTable("periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  financialYearId: uuid("financial_year_id").references(() => financialYears.id).notNull(),
  month: date("month").notNull(),          // first day of the month
  status: text("status", { enum: ["open", "closed"] }).default("open").notNull(),
  closingCash: bigint("closing_cash", { mode: "number" }),
  closingBank: bigint("closing_bank", { mode: "number" }),
  closedBy: uuid("closed_by").references(() => users.id),
  closedAt: timestamp("closed_at"),
}, (t) => [unique().on(t.financialYearId, t.month)]);

/** Stored fact. Everything reported is derived from this table and allocations. */
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  periodId: uuid("period_id").references(() => periods.id).notNull(),
  date: date("date").notNull(),
  kind: text("kind", { enum: ["receipt", "payment", "contra"] }).notNull(),
  particulars: text("particulars").notNull(),
  receiptNo: text("receipt_no"),
  vrNo: text("vr_no"),
  chequeNo: text("cheque_no"),
  cash: bigint("cash", { mode: "number" }).notNull().default(0),
  bank: bigint("bank", { mode: "number" }).notNull().default(0),
  // Derived from the disbursement and the rates in force at posting time, then
  // frozen — never recomputed if rates change. CLAUDE.md rule 7.
  enrolment: integer("enrolment"),
  contraFrom: text("contra_from", { enum: ["cash", "bank"] }),
  contraTo: text("contra_to", { enum: ["cash", "bank"] }),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("txn_period_idx").on(t.periodId, t.date)]);

export const allocations = pgTable("allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "cascade" }).notNull(),
  voteHeadId: uuid("vote_head_id").references(() => voteHeads.id).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
});

export const enrolments = pgTable("enrolments", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").references(() => schools.id).notNull(),
  term: text("term").notNull(),            // "2025 T3"
  learners: integer("learners").notNull(), // whole learners, never derived
}, (t) => [unique().on(t.schoolId, t.term)]);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  before: text("before"),
  after: text("after"),
  at: timestamp("at").defaultNow().notNull(),
}, (t) => [index("audit_org_idx").on(t.orgId, t.at)]);
