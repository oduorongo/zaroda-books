import { describe, expect, it } from "vitest";
import {
  LETTER_DEFAULTS, buildLetter, countWords, letterAmount, letterDate, maskAccountNo, programmeFor,
  termRoman, type LetterInput,
} from "../capitation-letter";
import { toCents } from "../money";

/** The Manyonge letter of 3 September 2026, account numbers masked. */
const manyonge: LetterInput = {
  level: "junior",
  term: 3,
  year: 2026,
  date: "2026-09-03",
  schoolName: "MANYONGE JUNIOR SCHOOL",
  details: {
    ...LETTER_DEFAULTS,
    shortName: "",
    postalAddress: "P.O. BOX 88-40400",
    town: "SUNA - MIGORI",
    subCounty: "Uriri",
    scdeAddress: "P.O. BOX 46 – 40400,",
    scdeTown: "SUNA – MIGORI.",
    signatoryName: "Kennedy Akang'o.",
    signatoryTitle: "AG. Principal",
  },
  accounts: [
    { name: "Operations", number: "1300000001", amount: toCents(197360), bankName: "Kenya Commercial Bank (KCB)", bankBranch: "Migori" },
    { name: "Tuition", number: "1300000002", amount: toCents(81119), bankName: "Kenya Commercial Bank (KCB)", bankBranch: "Migori" },
  ],
};

describe("programmeFor", () => {
  it("names the programme from the school's level, so the two cannot disagree", () => {
    expect(programmeFor("primary")).toEqual({ code: "FPE", level: "PRIMARY" });
    expect(programmeFor("junior")).toEqual({ code: "FDJS", level: "JUNIOR SCHOOL" });
    expect(programmeFor("senior")).toEqual({ code: "FDS", level: "SENIOR SCHOOL" });
  });
});

describe("termRoman", () => {
  it("prints the term as the Ministry writes it", () => {
    expect([1, 2, 3].map((t) => termRoman(t as 1 | 2 | 3))).toEqual(["I", "II", "III"]);
  });
});

describe("countWords", () => {
  it("spells small counts out", () => {
    expect(countWords(1)).toBe("one");
    expect(countWords(3)).toBe("three");
    expect(countWords(10)).toBe("ten");
  });

  it("falls back to the figure past ten", () => {
    expect(countWords(11)).toBe("11");
  });
});

describe("letterDate", () => {
  it("prints day, month and year with the closing full stop", () => {
    expect(letterDate("2026-09-03")).toBe("03/09/2026.");
  });
});

describe("maskAccountNo", () => {
  it("keeps only the last four digits", () => {
    expect(maskAccountNo("1234568582")).toBe("•••• 8582");
  });

  it("leaves a blank number blank", () => {
    expect(maskAccountNo("")).toBe("");
  });
});

describe("letterAmount", () => {
  it("prints whole shillings with thousands separators", () => {
    expect(letterAmount(toCents(197360), false)).toBe("197,360");
  });

  it("prints the cents when the letter carries any", () => {
    expect(letterAmount(toCents(81119.5), true)).toBe("81,119.50");
  });
});

describe("buildLetter", () => {
  const letter = buildLetter(manyonge);

  it("totals the accounts itself — the figure the sample letter shows", () => {
    expect(letter.total).toBe("278,479");
    expect(letter.rows.map((r) => r.amount)).toEqual(["197,360", "81,119"]);
  });

  it("writes the subject from the level, never from a free choice", () => {
    expect(letter.subject).toBe(
      "RE: CONFIRMATION OF RECEIPT OF FDJS FUNDS FOR JUNIOR SCHOOL TERM III, 2026",
    );
  });

  it("says how many accounts in words", () => {
    expect(letter.opening).toBe(
      "As the subject matter refers, MANYONGE JUNIOR SCHOOL received capitation in the two accounts as follows:",
    );
  });

  it("uses the short name in the body when one is given", () => {
    const short = buildLetter({ ...manyonge, details: { ...manyonge.details, shortName: "Manyonge JS" } });
    expect(short.opening).toContain("Manyonge JS received");
    expect(short.signature).toContain("MANYONGE JUNIOR SCHOOL");
  });

  it("names the bank once when every account is held there", () => {
    expect(letter.showBankColumn).toBe(false);
    expect(letter.bankLine).toBe("All the accounts are held at Kenya Commercial Bank (KCB), Migori Branch.");
  });

  it("shows a bank column when the accounts are held at different banks", () => {
    const split = buildLetter({
      ...manyonge,
      accounts: [manyonge.accounts[0], { ...manyonge.accounts[1], bankName: "Equity Bank" }],
    });
    expect(split.showBankColumn).toBe(true);
    expect(split.rows[1].bank).toBe("Equity Bank, Migori");
    expect(split.bankLine).toBe("The accounts are held at the banks shown above.");
  });

  it("speaks of one account in the singular", () => {
    const one = buildLetter({ ...manyonge, accounts: [manyonge.accounts[0]] });
    expect(one.opening).toContain("in the one account as follows:");
    expect(one.bankLine).toBe("The account is held at Kenya Commercial Bank (KCB), Migori Branch.");
  });

  it("prints cents on every line once any amount has them, so the total still adds up", () => {
    const cents = buildLetter({
      ...manyonge,
      accounts: [manyonge.accounts[0], { ...manyonge.accounts[1], amount: toCents(81119.5) }],
    });
    expect(cents.rows.map((r) => r.amount)).toEqual(["197,360.00", "81,119.50"]);
    expect(cents.total).toBe("278,479.50");
  });

  it("adds the punctuation itself, whatever was typed into the fields", () => {
    expect(letter.through).toEqual([
      "THE SUB-COUNTY DIRECTOR OF EDUCATION",
      "URIRI SUB-COUNTY",
      "P.O. BOX 46 – 40400",
      "SUNA – MIGORI",
    ]);
    expect(letter.signature).toEqual(["Kennedy Akang'o", "AG. Principal", "MANYONGE JUNIOR SCHOOL"]);
  });

  it("addresses the Principal Secretary with the Ministry defaults", () => {
    expect(letter.addressee).toEqual([
      "THE PRINCIPAL SECRETARY",
      "MINISTRY OF EDUCATION",
      "STATE DEPARTMENT FOR BASIC EDUCATION",
      "P.O. BOX 30040 – 00100",
      "NAIROBI – KENYA",
      "EMAIL: ps@education.go.ke",
    ]);
  });

  it("puts the school's address and the date at the head", () => {
    expect(letter.sender).toEqual(["MANYONGE JUNIOR SCHOOL", "P.O. BOX 88-40400", "SUNA - MIGORI"]);
    expect(letter.date).toBe("03/09/2026.");
  });

  it("names account rows in capitals, as the Ministry's forms do", () => {
    expect(letter.rows.map((r) => r.name)).toEqual(["OPERATIONS", "TUITION"]);
  });
});
