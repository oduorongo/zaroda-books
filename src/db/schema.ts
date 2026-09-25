import {
  pgTable, uuid, text, integer, bigint, date, timestamp, boolean, unique, uniqueIndex, index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** A firm or a school group. Freelance accountants get one org, many schools. */
export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Reviewed by Zaroda. Null means the free school is still held back; a
  // subscription entered by hand opens books either way, since payment was
  // review enough. Set from /admin, never by anything the tenant can reach.
  approvedAt: timestamp("approved_at"),
  approvedBy: uuid("approved_by"),
  // Where the subscriber is, taken at signup. Not where their schools are —
  // a freelancer in Nairobi keeps books for schools anywhere, so coverage of
  // the books is read from schools.county, not from here.
  county: text("county"),
  subCounty: text("sub_county"),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  // The subscriber's own number: who pays, and how they are reached. Not part
  // of a school's identity, since one freelancer keeps many schools on one number.
  phone: text("phone"),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  // Chosen at signup, changed only from the console. Null for accounts made
  // before it was asked. See src/domain/positions.ts.
  position: text("position", { enum: ["hoi", "bursar", "auditor", "freelancer"] }),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: text("role", { enum: ["owner", "accountant", "bursar", "viewer"] }).notNull(),
  /**
   * Tie this person to one school. Null is the whole practice, which is what
   * a freelancer and their own staff get.
   *
   * Without it, inviting one school's bursar to a freelancer who keeps thirty
   * would hand them every other school's books.
   */
  schoolId: uuid("school_id").references(() => schools.id),
  // Which books a person lands in when they belong to several: the oldest.
  // Without an order it would differ between page loads.
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.orgId, t.userId)]);

export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  name: text("name").notNull(),
  level: text("level", { enum: ["primary", "junior", "senior"] }).notNull(),
  county: text("county"),
  subCounty: text("sub_county"),
  // NEMIS has been withdrawn and KEMIS issues no school code, so the name is
  // the identity. nameKey is that name with case, spacing and punctuation taken
  // out, and it is what decides whether two books are the same school.
  nemisCode: text("nemis_code"),
  nameKey: text("name_key"),
}, (t) => [
  index("schools_org_idx").on(t.orgId),
  unique("schools_org_name").on(t.orgId, t.level, t.nameKey),
]);

/**
 * One payment per financial year per school level, covering every book that
 * level needs. The first school it is used for binds it, and the binding is
 * never released — that is what stops one subscription serving a second school
 * once the first one's figures have been copied out and the data removed.
 */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  level: text("level", { enum: ["primary", "junior", "senior"] }).notNull(),
  fyLabel: text("fy_label").notNull(),
  /** Written once, on the first book opened against it. Never cleared. */
  schoolId: uuid("school_id").references(() => schools.id),
  boundAt: timestamp("bound_at"),
  paidAt: timestamp("paid_at"),
  /**
   * The tenant's one free school. Granted once per org and never again, so the
   * presence of any such row is what says the allowance is spent. It is owed
   * nothing, so it is counted apart from both paid and unpaid.
   */
  isFree: boolean("is_free").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  unique("subscriptions_org_level_fy").on(t.orgId, t.level, t.fyLabel),
  /**
   * At most one free row per org, ever — enforced by the database rather than
   * by a read-then-write check in application code. Two book-creation
   * requests racing for the free grant used to both be able to read "not
   * used yet" before either had written its row; with this in place the
   * second INSERT is rejected outright, whatever order the requests land in.
   */
  uniqueIndex("subscriptions_one_free_per_org").on(t.orgId).where(sql`${t.isFree} = true`),
]);

/** One row per bank account / vote book: SIMBA, GPA, Operations, Boarding... */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").references(() => schools.id).notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  bankName: text("bank_name"),
  bankAccountNo: text("bank_account_no"),
  bankBranch: text("bank_branch"),
  // An archived book is hidden from the app but keeps every entry, so a year
  // an auditor asks for later still exists, and so a book that has been opened
  // stays counted however the subscription is billed.
  archivedAt: timestamp("archived_at"),
  archivedBy: uuid("archived_by").references(() => users.id),
  // The auditor's grant this closed year has been sent to. Only that auditor
  // sees the book, and reopening a month takes it back (cleared to null).
  auditSentTo: uuid("audit_sent_to").references((): AnyPgColumn => auditors.id),
  auditSentAt: timestamp("audit_sent_at"),
  auditSentBy: uuid("audit_sent_by").references(() => users.id),
});

/**
 * The addresses and signatory the capitation letter carries, saved once per
 * school. Blank Ministry fields fall back to LETTER_DEFAULTS.
 */
export const letterDetails = pgTable("letter_details", {
  schoolId: uuid("school_id").primaryKey().references(() => schools.id),
  shortName: text("short_name"),
  postalAddress: text("postal_address"),
  town: text("town"),
  scdeAddress: text("scde_address"),
  scdeTown: text("scde_town"),
  ministryName: text("ministry_name"),
  ministryAddress: text("ministry_address"),
  ministryEmail: text("ministry_email"),
  signatoryName: text("signatory_name"),
  signatoryTitle: text("signatory_title"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
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
  // A flat per-school grant in the same disbursement — the junior basic allocation.
  flatAmount: bigint("flat_amount", { mode: "number" }).notNull().default(0),
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
  // The closing balance on the bank statement for this month, as the bank
  // states it. Entered by the bursar from the statement — never derived, or
  // the reconciliation would be proving the book against itself.
  statementBank: bigint("statement_bank", { mode: "number" }),
  statementDate: date("statement_date"),
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
  // What a payment was for, printed on the voucher: "Being payment for ...".
  narration: text("narration"),
  chequeNo: text("cheque_no"),
  cash: bigint("cash", { mode: "number" }).notNull().default(0),
  bank: bigint("bank", { mode: "number" }).notNull().default(0),
  // Derived from the disbursement and the rates in force at posting time, then
  // frozen — never recomputed if rates change. CLAUDE.md rule 7.
  enrolment: integer("enrolment"),
  contraFrom: text("contra_from", { enum: ["cash", "bank"] }),
  contraTo: text("contra_to", { enum: ["cash", "bank"] }),
  // Set on the banking contra that carries a receipt from cash to bank. It
  // cascades, so amending or removing the receipt takes its banking with it and
  // the two can never drift apart.
  bankedFrom: uuid("banked_from").references((): AnyPgColumn => transactions.id, {
    onDelete: "cascade",
  }),
  // The date this entry appeared on the bank statement. Null means it has not
  // been ticked off, which is what makes it a reconciling item.
  clearedOn: date("cleared_on"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("txn_period_idx").on(t.periodId, t.date)]);

export const allocations = pgTable("allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "cascade" }).notNull(),
  voteHeadId: uuid("vote_head_id").references(() => voteHeads.id).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  // The circular figures this line was worked from, kept per receipt so an
  // amendment reopens the figures actually used, not the year's current rates.
  perLearner: bigint("per_learner", { mode: "number" }),
  flatAmount: bigint("flat_amount", { mode: "number" }),
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

/**
 * Zaroda Solutions itself. A system owner sits outside every org, so this is a
 * table of its own rather than a role on `memberships` — an org-scoped role that
 * could see across orgs would be a hole in the tenancy boundary. Rows are
 * granted by `scripts/grant-platform-admin.mjs`, never by anything in the app.
 */
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * One row per attempt to pay, created before the STK push goes out and updated
 * by whichever of the callback or the status poll gets there first.
 *
 * `rawResponse` and `callbackRaw` keep Tuma's bodies verbatim. Tuma publish no
 * API reference, so the field names we read are inference — keeping the
 * originals is what lets a payment be settled by hand if the inference is
 * wrong, and what lets the parsing be tightened once real traffic is seen.
 */
export const subscriptionPayments = pgTable("subscription_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  /** What this buys, so the callback knows which subscription to open. */
  level: text("level", { enum: ["primary", "junior", "senior"] }).notNull(),
  fyLabel: text("fy_label").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  phone: text("phone").notNull(),
  status: text("status", { enum: ["pending", "success", "failed"] }).default("pending").notNull(),
  merchantRequestId: text("merchant_request_id"),
  mpesaReceipt: text("mpesa_receipt"),
  description: text("description"),
  rawResponse: text("raw_response"),
  callbackRaw: text("callback_raw"),
  initiatedBy: uuid("initiated_by").references(() => users.id),
  /** Zaroda's own receipt reference, issued when the payment succeeds. */
  receiptNo: text("receipt_no"),
  /**
   * The book the tenant was trying to open when they were asked to pay. Held
   * here so the payment can finish the job it was started for: the callback
   * opens the book from these, and the bursar never retypes the form.
   */
  pendingSchoolName: text("pending_school_name"),
  pendingAccountType: text("pending_account_type"),
  /** The book the callback opened, so the waiting page can go straight to it. */
  createdAccountId: uuid("created_account_id").references(() => accounts.id),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("sub_payments_org_idx").on(t.orgId, t.createdAt),
  // The callback finds its payment by this, so it must be quick and unique.
  unique("sub_payments_merchant_request").on(t.merchantRequestId),
]);

/**
 * A Ministry internal auditor, granted the schools of one sub-county — or of
 * a whole county — wherever those schools' books are kept.
 *
 * This is the only thing besides platform_admins that reads across orgs, so
 * it is granted from /admin alone and never by a tenant. Access is strictly
 * read-only, enforced in the session rather than here, and every school an
 * auditor opens is written to audit_log.
 *
 * Revoked rather than deleted: who could see a school's books, and when, is
 * itself something an audit may ask about.
 */
export const auditors = pgTable("auditors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  county: text("county").notNull(),
  /** Null means every sub-county of that county. */
  subCounty: text("sub_county"),
  grantedBy: uuid("granted_by").references(() => users.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
}, (t) => [index("auditors_user_idx").on(t.userId)]);

/**
 * A Ministry auditor's query on a book, raised on one entry or on the book as
 * a whole. Never deleted: open is the school's turn, answered the auditor's,
 * closed is what the audit settled. See src/domain/audit-query.ts.
 */
export const auditQueries = pgTable("audit_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  accountId: uuid("account_id").references(() => accounts.id).notNull(),
  // Null for a query on the book as a whole. Kept if the entry is deleted,
  // so the query still says what it was about.
  transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  /** What the entry was when queried, e.g. "VR 23 · 2025-03-11 · KEPSHA · 41,000.00". */
  subject: text("subject").notNull(),
  status: text("status", { enum: ["open", "answered", "closed"] }).default("open").notNull(),
  raisedBy: uuid("raised_by").references(() => users.id).notNull(),
  raisedAt: timestamp("raised_at").defaultNow().notNull(),
  closedBy: uuid("closed_by").references(() => users.id),
  closedAt: timestamp("closed_at"),
}, (t) => [index("audit_queries_account_idx").on(t.accountId, t.status)]);

/** The conversation on a query, the auditor's first message included. */
export const auditQueryMessages = pgTable("audit_query_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  queryId: uuid("query_id").references(() => auditQueries.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  fromAuditor: boolean("from_auditor").notNull(),
  body: text("body").notNull(),
  at: timestamp("at").defaultNow().notNull(),
}, (t) => [index("audit_query_messages_query_idx").on(t.queryId, t.at)]);

/**
 * An invitation to join an org with a given role.
 *
 * There is no email service yet, so the owner passes the code to the person
 * themselves — by WhatsApp, as most things are here. That is why the code is
 * long and random rather than guessable, and why it expires: an invitation
 * read over someone's shoulder should not be usable a month later.
 */
export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => orgs.id).notNull(),
  /** Who it was meant for, so an owner can see what they sent. */
  email: text("email").notNull(),
  role: text("role", { enum: ["owner", "accountant", "bursar", "viewer"] }).notNull(),
  /** The one school this invitation is for, or null for the whole practice. */
  schoolId: uuid("school_id").references(() => schools.id),
  code: text("code").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  acceptedBy: uuid("accepted_by").references(() => users.id),
  revokedAt: timestamp("revoked_at"),
}, (t) => [index("invitations_org_idx").on(t.orgId)]);

/**
 * A password reset in flight.
 *
 * The token is stored hashed, for the same reason passwords are: anyone who
 * reads this table should not thereby be able to take over an account. It is
 * single use and short-lived, because the link sits in an inbox afterwards.
 */
export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  requestedIp: text("requested_ip"),
}, (t) => [index("password_resets_user_idx").on(t.userId)]);

/**
 * One row per signed-in device.
 *
 * A session used to be a signed cookie and nothing more, which meant it could
 * not be taken back: a lost phone stayed signed in for thirty days, and
 * changing a password shut nobody out. The cookie now carries a random token
 * whose hash is here, so a session can be revoked the moment it needs to be.
 *
 * The token is stored hashed, like a password and for the same reason.
 */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at"),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  // Enough to recognise a device in a list, never enough to identify a person
  // beyond what their own browser already announces.
  userAgent: text("user_agent"),
  ip: text("ip"),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

/**
 * Failed password attempts, for the login throttle.
 *
 * Only failures are kept, and only for as long as the window needs them: a
 * log of who signed in successfully from where is a surveillance record this
 * product has no reason to hold.
 */
export const loginFailures = pgTable("login_failures", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  ip: text("ip"),
  at: timestamp("at").defaultNow().notNull(),
}, (t) => [
  index("login_failures_email_idx").on(t.email, t.at),
  index("login_failures_ip_idx").on(t.ip, t.at),
]);

/**
 * Things that went wrong and that somebody needs to know about.
 *
 * Until now these went to console.error, which on Vercel means a log nobody
 * reads. The one that matters most — a tenant paid and their book could not
 * be opened — would have been invisible until they complained.
 *
 * Deliberately not a general application log. Only failures a person has to
 * act on, so the list stays short enough to be read.
 */
export const problems = pgTable("problems", {
  id: uuid("id").primaryKey().defaultRandom(),
  at: timestamp("at").defaultNow().notNull(),
  /** "payment", "email", "gateway" — coarse, so like things group together. */
  area: text("area").notNull(),
  message: text("message").notNull(),
  detail: text("detail"),
  /** The tenant affected, where there is one. */
  orgId: uuid("org_id").references(() => orgs.id),
  seenAt: timestamp("seen_at"),
  seenBy: uuid("seen_by").references(() => users.id),
}, (t) => [index("problems_at_idx").on(t.at)]);
