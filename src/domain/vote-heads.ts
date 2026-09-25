import type { Cents } from "./money.ts";
import { toCents } from "./money.ts";
import type { VoteHead } from "./types.ts";

export type SchoolLevel = "primary" | "junior" | "senior";

export const SCHOOL_LEVELS: SchoolLevel[] = ["primary", "junior", "senior"];

/**
 * What each level is called, everywhere it is shown. One place, because the
 * first drafts said "Secondary" in one form and "Senior school" in another,
 * and a bursar seeing both wonders whether they are the same thing.
 */
export const LEVEL_LABEL: Record<SchoolLevel, string> = {
  primary: "Primary school",
  junior: "Junior school",
  senior: "Senior school",
};

/** Ready for a dropdown, in the order a school grows. */
export const LEVEL_OPTIONS: { id: SchoolLevel; label: string }[] =
  SCHOOL_LEVELS.map((id) => ({ id, label: LEVEL_LABEL[id] }));

export type AccountType =
  | "TUITION" | "OPERATIONS" | "INFRASTRUCTURE" | "BOARDING" | "LUNCH";

export interface ChartHead extends VoteHead {
  /** Rate per learner in the circular. Absent where the head is unfunded. */
  perLearner?: Cents;
  /** Flat per-school grant riding in the same disbursement. */
  flat?: Cents;
}

export interface Chart {
  label: string;
  /** The circular the figures came from, shown when the book is created. */
  source?: string;
  heads: ChartHead[];
}

type Row = [code: string, name: string, perLearner?: number, flat?: number];

const heads = (...rows: Row[]): ChartHead[] =>
  rows.map(([code, name, perLearner, flat], i) => ({
    code,
    name,
    order: i + 1,
    ...(perLearner === undefined ? {} : { perLearner: toCents(perLearner) }),
    ...(flat === undefined ? {} : { flat: toCents(flat) }),
  }));

/** Unfunded by any circular, but banks debit every account. */
const BANK_CHARGES: Row = ["BCH", "Bank charges"];

/** Funded by the transfer of maintenance and improvement out of operations. */
const infrastructure: Chart = {
  label: "Infrastructure",
  heads: heads(
    ["CIV", "Civil works"],
    ["FUR", "Furniture and equipment"],
    ["PRO", "Professional fees"],
    BANK_CHARGES,
  ),
};

/** School funds, not capitation — carried over from the workbooks. */
const boarding: Chart = {
  label: "Boarding",
  heads: heads(
    ["BES", "Boarding, equipment and stores"],
    ["RMI", "Repairs, maintenance and improvement"],
    ["OTV", "Other votes"], ["BUR", "Bursary"], ["PER", "Personal emoluments"],
    ["BUS", "School bus"], ["LTT", "Local travel and transport"],
    ["EWC", "Electricity, water and conservancy"], ["MED", "Medical"],
    ["ADM", "Administration costs"], BANK_CHARGES, ["REF", "Refunds"],
  ),
};

const lunch: Chart = {
  label: "Lunch",
  heads: heads(["FOD", "Food"], ["FUE", "Fuel"], ["LAB2", "Labour"], BANK_CHARGES),
};

/**
 * Only what the Ministry actually banks for the school is a vote head.
 * Centrally procured items — KICD textbooks, SMASSE/CEMESTEA capacity
 * building, and the centralised share of the junior co-curricular vote — are
 * remitted elsewhere and never reach the school account, so allocating to
 * them could never reconcile against the amount received.
 *
 * Schools may add heads of their own; they may never renumber these.
 */
export const CHART_OF_ACCOUNTS: Record<SchoolLevel, Partial<Record<AccountType, Chart>>> = {
  // FPE — MOE/DBE/6/2/3/27, 25 July 2024.
  primary: {
    TUITION: {
      label: "Tuition (Account 1 — SIMBA)",
      source: "FPE circular MOE/DBE/6/2/3/27, 25 July 2024 — KSh 144.00 per learner",
      heads: heads(
        ["EXB", "Exercise books", 82.69],
        ["TGR", "Teachers guides and reference materials", 31.28],
        ["STN", "Stationery", 18.77],
        ["ASS", "Assessments", 11.26],
        // Introduced by the FPE circulars of 2025.
        ["TXB", "Textbooks and supplementary readers"],
        ["TXM", "Textbooks maintenance"],
        BANK_CHARGES,
      ),
    },
    OPERATIONS: {
      label: "Operations (Account 2 — GPA)",
      source: "FPE circular MOE/DBE/6/2/3/27, 25 July 2024 — KSh 186.00 per learner",
      heads: heads(
        ["SSW", "Support staff wages", 56.57],
        ["RMI", "Renovation, repairs, maintenance and improvement of physical facilities", 31.66],
        ["ACT", "Activity", 3.00],
        ["LTT", "Local transport and travelling", 13.39],
        ["EWC", "Electricity, water and conservancy", 18.96],
        ["TEL", "Telephone, box rental and postage", 3.02],
        ["ENV", "Environment and sanitation", 15.73],
        ["BOM", "Capacity building and meetings (BOM)", 28.23],
        ["CON", "Contingencies", 4.84],
        ["SAT", "Science and applied technology", 6.16],
        ["ICT", "ICT infrastructure materials", 4.44],
        ["ASS", "Assessment and examinations"],
        BANK_CHARGES,
      ),
    },
    INFRASTRUCTURE: infrastructure,
    BOARDING: boarding,
    LUNCH: lunch,
  },

  // FDJSE — MOE.HQs/3/7/33(15), 24 June 2024.
  junior: {
    TUITION: {
      label: "Tuition",
      source:
        "FDJSE circular MOE.HQs/3/7/33(15), 24 June 2024 — KSh 1,746.38 per learner " +
        "plus a flat KSh 696.97 per school (Table 1A)",
      heads: heads(
        ["TGR", "Teachers guides and reference materials", undefined, 696.97],
        ["LAB", "Laboratory materials", 135.00],
        ["MFP", "Materials for practicals under CBC", 740.00],
        ["ASS", "Assessment", 209.38],
        ["STN", "Stationery and writing materials", 662.00],
        BANK_CHARGES,
      ),
    },
    OPERATIONS: {
      label: "Operations",
      source:
        "FDJSE circular MOE.HQs/3/7/33(15), 24 June 2024 — KSh 1,976.00 per learner " +
        "plus a flat KSh 37,520.00 basic allocation per school (Table 1A)",
      heads: heads(
        ["RMI", "Repairs, maintenance and improvement", 1000.00],
        ["ADM", "Administrative costs", 275.00],
        ["ACT", "Co-curricular activities", 240.00],
        ["LTT", "Local transport and travel", 400.00],
        ["MED", "Medical and insurance", 61.00],
        ["TEL", "Rental, box and postage, telephone, BOM meetings and capacity building", undefined, 3620.00],
        ["EWC", "Electricity, water and conservancy", undefined, 2880.00],
        ["INT", "Internet connectivity and ICT integration", undefined, 4500.00],
        ["PER", "Personal emoluments", undefined, 26520.00],
        BANK_CHARGES,
      ),
    },
    INFRASTRUCTURE: infrastructure,
    BOARDING: boarding,
    LUNCH: lunch,
  },

  // FDSE — MOE.HQS/3/13/10, 28 July 2026.
  senior: {
    TUITION: {
      label: "Tuition",
      source: "FDSE circular MOE.HQS/3/13/10, 28 July 2026 — KSh 523.25 per learner banked",
      heads: heads(
        ["TLM", "Teaching and learning materials", 523.25],
        BANK_CHARGES,
      ),
    },
    OPERATIONS: {
      label: "Operations",
      source: "FDSE circular MOE.HQS/3/13/10, 28 July 2026 — KSh 2,468.96 per learner",
      heads: heads(
        ["RMI", "Maintenance and improvement", 600.00],
        ["OTV", "Other vote heads — personnel emoluments, internet connectivity, EWC, administration costs", 1418.96],
        ["ACT", "Co-curricular activities", 200.00],
        ["MED", "Medical and insurance", 250.00],
        BANK_CHARGES,
      ),
    },
    INFRASTRUCTURE: infrastructure,
    BOARDING: boarding,
    LUNCH: lunch,
  },
};

export const chartFor = (level: SchoolLevel, accountType: AccountType): Chart | undefined =>
  CHART_OF_ACCOUNTS[level]?.[accountType];

export const accountTypesFor = (level: SchoolLevel) =>
  (Object.keys(CHART_OF_ACCOUNTS[level] ?? {}) as AccountType[])
    .map((id) => ({ id, ...CHART_OF_ACCOUNTS[level]![id]! }));

/**
 * Heads the circular funds as a flat grant per school, with no rate per
 * learner. The rate box for these is closed on a receipt: a per-learner
 * figure on them is not a small error, it would inflate the derived enrolment.
 *
 * Taken from the chart rather than from the rates a book happens to hold, so
 * a stale figure can never close a box that should be open. The same code can
 * be rated in one chart and flat in another — TGR is 31.28 a learner at
 * primary and a 696.97 flat at junior.
 */
export const flatOnlyHeadCodes = (level: SchoolLevel, accountType: AccountType): string[] =>
  (chartFor(level, accountType)?.heads ?? [])
    .filter((h) => h.flat && !h.perLearner)
    .map((h) => h.code);

/**
 * Whether this account is funded by capitation, and so has an enrolment to
 * derive and an acknowledgement to return to the Ministry.
 *
 * Read from the chart rather than kept as a second list: an account is
 * capitation funded exactly when one of its heads carries a rate from a
 * circular. Boarding, lunch and infrastructure carry none — parents pay into
 * them, or they are funded by transfer — so a per-learner figure there would
 * be an invention.
 */
export const isCapitationAccount = (level: SchoolLevel, accountType: AccountType): boolean =>
  (chartFor(level, accountType)?.heads ?? []).some((h) => h.perLearner || h.flat);
