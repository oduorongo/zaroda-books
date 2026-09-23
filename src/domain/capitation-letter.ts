/**
 * The letter a school returns to the Principal Secretary confirming the
 * capitation it received for a term.
 *
 * Every figure comes from receipts already in the books; the letter only
 * lays them out. The programme is read from the school's level, because the
 * letter this was modelled on said "FDS funds" for a junior school.
 */
import type { Cents } from "./money.ts";
import type { SchoolLevel } from "./vote-heads.ts";

export type Term = 1 | 2 | 3;
export const TERMS: Term[] = [1, 2, 3];

const PROGRAMME: Record<SchoolLevel, { code: string; level: string }> = {
  primary: { code: "FPE", level: "PRIMARY" },
  junior: { code: "FDJS", level: "JUNIOR SCHOOL" },
  senior: { code: "FDS", level: "SENIOR SCHOOL" },
};

export const programmeFor = (level: SchoolLevel) => PROGRAMME[level];

export const termRoman = (term: Term) => ["I", "II", "III"][term - 1];

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const countWords = (n: number) => WORDS[n] ?? String(n);

export const letterDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}.`;
};

export const maskAccountNo = (no: string) => (no ? `•••• ${no.slice(-4)}` : "");

export const letterAmount = (c: Cents, withCents: boolean) =>
  (c / 100).toLocaleString("en-KE", {
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  });

/** What the school saves once and every letter reuses. */
export interface LetterDetails {
  shortName: string;
  postalAddress: string;
  town: string;
  subCounty: string;
  scdeAddress: string;
  scdeTown: string;
  /** One line per line of the letter: the Ministry, then the State Department. */
  ministryName: string;
  ministryAddress: string;
  ministryEmail: string;
  signatoryName: string;
  signatoryTitle: string;
}

export const LETTER_DEFAULTS: Pick<LetterDetails, "ministryName" | "ministryAddress" | "ministryEmail"> = {
  ministryName: "MINISTRY OF EDUCATION\nSTATE DEPARTMENT FOR BASIC EDUCATION",
  ministryAddress: "P.O. BOX 30040 – 00100",
  ministryEmail: "ps@education.go.ke",
};

export interface LetterAccount {
  name: string;
  number: string;
  amount: Cents;
  bankName: string;
  bankBranch: string;
}

export interface LetterInput {
  level: SchoolLevel;
  term: Term;
  year: number;
  /** ISO yyyy-mm-dd. */
  date: string;
  schoolName: string;
  details: LetterDetails;
  accounts: LetterAccount[];
}

export interface Letter {
  sender: string[];
  date: string;
  addressee: string[];
  through: string[];
  subject: string;
  opening: string;
  showBankColumn: boolean;
  rows: { name: string; number: string; bank: string; amount: string }[];
  total: string;
  bankLine: string;
  signature: string[];
}

/** The template supplies the punctuation, so a trailing stop typed into a field is dropped. */
const clean = (s: string) => s.trim().replace(/[\s.,;:]+$/, "");
const lines = (...xs: string[]) => xs.flatMap((x) => x.split("\n")).map(clean).filter(Boolean);
const bankOf = (a: LetterAccount) => [clean(a.bankName), clean(a.bankBranch)].filter(Boolean).join(", ");

export function buildLetter(input: LetterInput): Letter {
  const { details: d, accounts } = input;
  const programme = programmeFor(input.level);
  const withCents = accounts.some((a) => a.amount % 100 !== 0);
  const total = accounts.reduce((s, a) => s + a.amount, 0);

  const banks = new Set(accounts.map(bankOf));
  const shared = banks.size === 1 && accounts[0] && clean(accounts[0].bankName) ? accounts[0] : null;
  const branch = shared && clean(shared.bankBranch) ? `, ${clean(shared.bankBranch)} Branch` : "";
  const one = accounts.length === 1;

  return {
    sender: lines(input.schoolName, d.postalAddress, d.town),
    date: letterDate(input.date),
    addressee: lines(
      "THE PRINCIPAL SECRETARY",
      d.ministryName,
      d.ministryAddress,
      "NAIROBI – KENYA",
      d.ministryEmail ? `EMAIL: ${clean(d.ministryEmail)}` : "",
    ),
    through: lines(
      "THE SUB-COUNTY DIRECTOR OF EDUCATION",
      d.subCounty ? `${clean(d.subCounty).toUpperCase()} SUB-COUNTY` : "",
      d.scdeAddress,
      d.scdeTown,
    ),
    subject: `RE: CONFIRMATION OF RECEIPT OF ${programme.code} FUNDS FOR ${programme.level} `
      + `TERM ${termRoman(input.term)}, ${input.year}`,
    opening: `As the subject matter refers, ${clean(d.shortName) || clean(input.schoolName)} received `
      + `capitation in the ${countWords(accounts.length)} account${one ? "" : "s"} as follows:`,
    showBankColumn: !shared,
    rows: accounts.map((a) => ({
      name: clean(a.name).toUpperCase(),
      number: a.number.trim(),
      bank: bankOf(a),
      amount: letterAmount(a.amount, withCents),
    })),
    total: letterAmount(total, withCents),
    bankLine: shared
      ? `${one ? "The account is" : "All the accounts are"} held at ${clean(shared.bankName)}${branch}.`
      : `The ${one ? "account is" : "accounts are"} held at the banks shown above.`,
    signature: lines(d.signatoryName, d.signatoryTitle, input.schoolName),
  };
}
