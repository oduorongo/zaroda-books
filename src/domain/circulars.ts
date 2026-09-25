import type { Cents } from "./money";
import { toCents } from "./money";
import type { AccountType, SchoolLevel } from "./vote-heads";

/**
 * The Ministry's capitation circulars, as issued, for filling in a receipt.
 * Only what is disbursed to the school is entered — centrally procured items
 * (KICD textbooks, SMASSE, the retained share of RMI or co-curricular) never
 * reach the school account. A book with no circular here is filled by hand.
 *
 * A circular is its reference and its date together: the Ministry reuses a
 * reference across terms — MOE.HQs/3/7/33(15) heads four junior circulars.
 */
export interface CircularAccount {
  perLearner: Record<string, Cents>;
  flat: Record<string, Cents>;
  /** The totals the circular prints, which the figures above must add to. */
  perLearnerTotal: Cents;
  flatTotal: Cents;
}

export interface Circular {
  programme: "FPE" | "FDJSE" | "FDSE";
  level: SchoolLevel;
  ref: string;
  /** ISO date of issue; a month alone where the copy shows no date. */
  date: string;
  /** What the circular says it releases. */
  term: string;
  note?: string;
  accounts: Partial<Record<AccountType, CircularAccount>>;
}

type Kes = Record<string, number>;

const cents = (xs: Kes) => Object.fromEntries(Object.entries(xs).map(([k, v]) => [k, toCents(v)]));

const account = (perLearner: Kes, flat: Kes, perLearnerTotal: number, flatTotal: number): CircularAccount => ({
  perLearner: cents(perLearner),
  flat: cents(flat),
  perLearnerTotal: toCents(perLearnerTotal),
  flatTotal: toCents(flatTotal),
});

export const CIRCULARS: Circular[] = [
  // ---- Primary (FPE): Account 1 is tuition (SIMBA), Account 2 operations (GPA).
  {
    programme: "FPE", level: "primary", ref: "MOE/DBE/6/2/3/27", date: "2024-07-25",
    term: "Disbursement to accounts 1 and 2",
    accounts: {
      TUITION: account({ EXB: 82.69, TGR: 31.28, STN: 18.77, ASS: 11.26 }, {}, 144.00, 0),
      OPERATIONS: account({
        SSW: 56.57, RMI: 31.66, ACT: 3.00, LTT: 13.39, EWC: 18.96, TEL: 3.02,
        ENV: 15.73, BOM: 28.23, CON: 4.84, SAT: 6.16, ICT: 4.44,
      }, {}, 186.00, 0),
    },
  },
  {
    programme: "FPE", level: "primary", ref: "MOE/DBE/6/2/3/29", date: "2025-01-24",
    term: "Disbursement to accounts 1 and 2",
    accounts: {
      TUITION: account({ TXB: 39.70, TXM: 11.00, EXB: 153.50, TGR: 54.80, STN: 36.50 }, {}, 295.50, 0),
      OPERATIONS: account({
        SSW: 96.40, RMI: 51.70, ACT: 17.90, LTT: 17.20, EWC: 31.00, TEL: 3.50,
        ENV: 27.60, BOM: 41.30, CON: 6.90, SAT: 6.90, ICT: 6.90, ASS: 17.20,
      }, {}, 324.50, 0),
    },
  },
  {
    programme: "FPE", level: "primary", ref: "MOE/DBE/6/2/3/28", date: "2025-05-22",
    term: "Disbursement to accounts 1 and 2",
    note: "The tables are headed SIMBA 144.00 and GPA 186.00, left over from 2024; the amounts are 84.80 and 80.00.",
    accounts: {
      TUITION: account({ TXB: 20.20, TXM: 4.00, EXB: 40.00, TGR: 10.20, STN: 10.40 }, {}, 84.80, 0),
      OPERATIONS: account({
        SSW: 20.00, RMI: 13.00, ACT: 10.00, LTT: 3.00, EWC: 8.00, TEL: 3.00,
        ENV: 5.00, BOM: 10.00, CON: 2.00, SAT: 2.00, ASS: 4.00,
      }, {}, 80.00, 0),
    },
  },

  {
    programme: "FPE", level: "primary", ref: "MOE.DBE/6/2/3/27", date: "2025-09-26",
    term: "Disbursement to accounts 1 and 2",
    note: "Same reference number as the circular of 25 July 2024. The tables are headed SIMBA 144.00 and GPA 186.00; the amounts are 146.20 and 137.80.",
    accounts: {
      TUITION: account({ TXB: 43.87, TXM: 4.39, EXB: 61.41, TGR: 21.93, STN: 14.60 }, {}, 146.20, 0),
      OPERATIONS: account({
        SSW: 38.58, RMI: 20.67, ACT: 15.15, LTT: 6.89, EWC: 12.40, TEL: 4.14,
        ENV: 11.02, BOM: 16.54, CON: 2.76, SAT: 2.76, ASS: 6.89,
      }, {}, 137.80, 0),
    },
  },

  // ---- Junior (FDJSE): a rate per learner, plus a basic allocation per school.
  {
    programme: "FDJSE", level: "junior", ref: "MOE.HQs/3/7/33(15)", date: "2024-01-26",
    term: "Term 1 2024, first tranche",
    note: "Reference materials are printed as 1,446.075, which cannot be paid; 1,446.08 is used.",
    accounts: {
      OPERATIONS: account(
        { RMI: 800, ADM: 130, ACT: 10, LTT: 160, MED: 90.50 },
        { TEL: 22625, EWC: 3000, INT: 9375, PER: 33150 }, 1190.50, 68150,
      ),
      TUITION: account({ LAB: 112.50, MFP: 150, ASS: 121.34, STN: 500 }, { TGR: 1446.08 }, 883.84, 1446.08),
    },
  },
  {
    programme: "FDJSE", level: "junior", ref: "MOE.HQS/3/4/15/VOL.II", date: "2024-04-11",
    term: "Term 1 2024, second tranche",
    note: "Co-curricular rises from 10 to 150 a learner; the circular says every other vote head is as in MOE.HQs/3/7/33(15) of 26 January 2024, and the basic allocation is taken as unchanged too.",
    accounts: {
      OPERATIONS: account(
        { RMI: 800, ADM: 130, ACT: 150, LTT: 160, MED: 90.50 },
        { TEL: 22625, EWC: 3000, INT: 9375, PER: 33150 }, 1330.50, 68150,
      ),
      TUITION: account({ LAB: 112.50, MFP: 150, ASS: 121.34, STN: 500 }, { TGR: 1446.08 }, 883.84, 1446.08),
    },
  },
  {
    programme: "FDJSE", level: "junior", ref: "MOE.HQs/3/7/33(15)", date: "2024-06-24",
    term: "Term 2 2024",
    accounts: {
      OPERATIONS: account(
        { RMI: 1000, ADM: 275, ACT: 240, LTT: 400, MED: 61 },
        { TEL: 58416.37, EWC: 4647.49, INT: 11667.14, PER: 199713 }, 1976, 274444,
      ),
      TUITION: account({ LAB: 135, MFP: 740, ASS: 209.38, STN: 662 }, {}, 1746.38, 0),
    },
  },
  {
    programme: "FDJSE", level: "junior", ref: "Not shown on the copy", date: "2025-01",
    term: "Headed First Term 2025; the text says Term 3, 2024",
    note: "Only the top of this circular was sent: its reference, date and tuition rates per learner are not on the copy, so tuition is entered by hand. RMI was retained centrally.",
    accounts: {
      OPERATIONS: account(
        { ADM: 243.75, ACT: 168.75, LTT: 300, MED: 143.45 },
        { TEL: 27150, EWC: 3600, INT: 11250, PER: 66300 }, 855.95, 108300,
      ),
    },
  },
  {
    programme: "FDJSE", level: "junior", ref: "MOE.HQs/3/7/33(15)", date: "2025-05-28",
    term: "Term 2 2025",
    accounts: {
      OPERATIONS: account(
        { RMI: 1200, ADM: 81.90, ACT: 50, LTT: 120, MED: 81 },
        { TEL: 27150, EWC: 2160, INT: 6750, PER: 46410 }, 1532.90, 82470,
      ),
      TUITION: account({ LAB: 81.87, MFP: 219.62, ASS: 118.40, STN: 366 }, { TGR: 1735.29 }, 785.89, 1735.29),
    },
  },
  {
    programme: "FDJSE", level: "junior", ref: "MOE.HQS/3/7/33(16)", date: "2025-10-28",
    term: "Term 3 2025",
    accounts: {
      OPERATIONS: account(
        { RMI: 560, ADM: 91, ACT: 147.30, LTT: 112, MED: 63 },
        { TEL: 10860, EWC: 1440, INT: 4500, PER: 26520 }, 973.30, 43320,
      ),
      TUITION: account({ LAB: 45, MFP: 120, ASS: 64.70, STN: 200 }, { TGR: 771.24 }, 429.70, 771.24),
    },
  },
  {
    programme: "FDJSE", level: "junior", ref: "MOE.HQS/3/7/33(17)", date: "2026-01-06",
    term: "Term 1 2026",
    accounts: {
      OPERATIONS: account(
        { RMI: 1600, ADM: 130, ACT: 100, LTT: 140, MED: 77.71 },
        { TEL: 22937.23, EWC: 3000, INT: 9375, PER: 55250 }, 2047.71, 90562.23,
      ),
      TUITION: account({ LAB: 119.25, MFP: 300, ASS: 130.05, STN: 500.39 }, { TGR: 1928.10 }, 1049.69, 1928.10),
    },
  },
  {
    programme: "FDJSE", level: "junior", ref: "MOE.HQs/3/7/33(15)", date: "2026-04-22",
    term: "Term 2 2026",
    accounts: {
      OPERATIONS: account(
        { RMI: 751.93, ADM: 130, ACT: 100, LTT: 96, MED: 45 },
        { TEL: 24902, EWC: 1550.26, INT: 1530.74, PER: 22017 }, 1122.93, 50000,
      ),
      TUITION: account({ LAB: 53.06, MFP: 103.12, ASS: 70.20, STN: 173.62 }, { TGR: 1145.54 }, 400, 1145.54),
    },
  },
  {
    programme: "FDJSE", level: "junior", ref: "MOE.HQs/3/7/33(15)", date: "2026-08-19",
    term: "Term 3 2026",
    accounts: {
      OPERATIONS: account(
        { RMI: 640, ADM: 78, ACT: 140, LTT: 96, MED: 45 },
        { TEL: 3620, EWC: 2880, INT: 4500, PER: 26520 }, 999, 37520,
      ),
      TUITION: account({ LAB: 81, MFP: 144, ASS: 77.64, STN: 200 }, { TGR: 696.97 }, 502.64, 696.97),
    },
  },

  // ---- Senior (FDSE): the figures the app was built with; no copy sent yet.
  {
    programme: "FDSE", level: "senior", ref: "MOE.HQS/3/13/10", date: "2026-07-28",
    term: "Release of FDSE funds",
    accounts: {
      TUITION: account({ TLM: 523.25 }, {}, 523.25, 0),
      OPERATIONS: account({ RMI: 600, OTV: 1418.96, ACT: 200, MED: 250 }, {}, 2468.96, 0),
    },
  },
];

/** A book's circulars, newest first — the one a bursar most likely wants. */
export const circularsFor = (level: SchoolLevel, accountType: AccountType): Circular[] =>
  CIRCULARS
    .filter((c) => c.level === level && c.accounts[accountType])
    .sort((a, b) => b.date.localeCompare(a.date));
