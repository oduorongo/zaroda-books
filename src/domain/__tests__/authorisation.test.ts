import { describe, expect, it } from "vitest";
import {
  authorisationLine, authorisationState, auditBlockReason, codeUsable, mayAuthorise, paymentTerms,
  readDecisions, voucherAuthorisationText, MAX_CODE_TRIES, type AuthorisationRecord,
} from "../authorisation";
import type { Payment } from "../types";

const pay = (over: Partial<Payment> = {}): Payment => ({
  id: "p1", kind: "payment", date: "2025-02-10", particulars: "Mwangi Hardware",
  vrNo: "3", chequeNo: "000123", narration: "Being payment for cement",
  cash: 0, bank: 1_500_000,
  allocations: [{ voteHeadCode: "RMI", amount: 1_000_000 }, { voteHeadCode: "EWC", amount: 500_000 }],
  ...over,
});

const rec = (over: Partial<AuthorisationRecord> = {}): AuthorisationRecord => ({
  decision: "authorised", terms: paymentTerms(pay()), route: "email", reason: null,
  hoiName: "Jane Otieno", hoiTsc: "123456", sentTo: "jane@school.ac.ke",
  signedOn: null, at: new Date("2025-02-12T11:12:00Z"), selfAuthorised: false,
  ...over,
});

describe("paymentTerms, what the head of institution approves", () => {
  it("ignores the voucher number, which renumbering changes", () => {
    expect(paymentTerms(pay({ vrNo: "3" }))).toBe(paymentTerms(pay({ vrNo: "4" })));
  });

  it("does not depend on the order the vote heads were entered in", () => {
    const flipped = pay({ allocations: [...pay().allocations].reverse() });
    expect(paymentTerms(flipped)).toBe(paymentTerms(pay()));
  });

  it("changes when anything that makes the payment changes", () => {
    const base = paymentTerms(pay());
    for (const change of [
      { date: "2025-02-11" }, { particulars: "Other" }, { narration: "x" }, { chequeNo: "9" },
      { cash: 1_500_000, bank: 0 },
      { allocations: [{ voteHeadCode: "RMI", amount: 1_500_000 }] },
    ] as Partial<Payment>[]) {
      expect(paymentTerms(pay(change)), JSON.stringify(change)).not.toBe(base);
    }
  });
});

describe("authorisationState", () => {
  const terms = paymentTerms(pay());

  it("is awaiting when nothing has been decided", () => {
    expect(authorisationState(terms, undefined).state).toBe("awaiting");
  });

  it("is authorised when the payment is as the head approved it", () => {
    expect(authorisationState(terms, rec()).state).toBe("authorised");
  });

  it("is changed when the payment was amended after it was authorised", () => {
    const amended = paymentTerms(pay({ bank: 1_600_000 }));
    expect(authorisationState(amended, rec()).state).toBe("changed");
  });

  it("carries the head's reason for holding a payment back", () => {
    const s = authorisationState(terms, rec({ decision: "held", reason: "No delivery note" }));
    expect(s).toMatchObject({ state: "held", reason: "No delivery note" });
  });

  it("goes back to awaiting once a held payment is corrected", () => {
    const corrected = paymentTerms(pay({ bank: 1_400_000 }));
    expect(authorisationState(corrected, rec({ decision: "held", reason: "Wrong amount" })).state).toBe("awaiting");
  });
});

describe("mayAuthorise", () => {
  it("lets the invited authoriser authorise", () => {
    expect(mayAuthorise("authoriser", null)).toBe(true);
  });

  it("lets a head of institution who owns the books authorise", () => {
    expect(mayAuthorise("owner", "hoi")).toBe(true);
  });

  it("never lets a freelancer or a bursar authorise their own work", () => {
    expect(mayAuthorise("owner", "freelancer")).toBe(false);
    expect(mayAuthorise("owner", "bursar")).toBe(false);
    expect(mayAuthorise("owner", null)).toBe(false);
    expect(mayAuthorise("bursar", "hoi")).toBe(false);
    expect(mayAuthorise("accountant", "hoi")).toBe(false);
    expect(mayAuthorise("viewer", "hoi")).toBe(false);
  });
});

describe("authorisationLine, printed on the voucher", () => {
  it("names the head and the address the code went to", () => {
    const line = authorisationLine(rec());
    expect(line).toMatch(/Jane Otieno/);
    expect(line).toMatch(/TSC 123456/);
    expect(line).toMatch(/code emailed to jane@school\.ac\.ke/);
  });

  it("names the signed schedule for a paper authorisation", () => {
    const line = authorisationLine(rec({ route: "paper", sentTo: null, signedOn: "2025-02-14" }));
    expect(line).toMatch(/signed schedule/i);
    expect(line).toMatch(/2025-02-14/);
  });

  it("says so when the head entered the payment and authorised it too", () => {
    expect(authorisationLine(rec({ route: "login", selfAuthorised: true })))
      .toMatch(/entered and authorised by the same person/i);
    expect(authorisationLine(rec({ route: "login" }))).not.toMatch(/same person/i);
  });
});

describe("codeUsable", () => {
  const issued = new Date("2025-02-12T10:00:00Z");

  it("accepts a fresh code", () => {
    expect(codeUsable({ issuedAt: issued, tries: 0, now: new Date("2025-02-12T10:05:00Z") })).toBe(true);
  });

  it("refuses a code after fifteen minutes", () => {
    expect(codeUsable({ issuedAt: issued, tries: 0, now: new Date("2025-02-12T10:16:00Z") })).toBe(false);
  });

  it("refuses a code once the tries are spent", () => {
    expect(codeUsable({ issuedAt: issued, tries: MAX_CODE_TRIES, now: issued })).toBe(false);
  });

  it("refuses when no code was sent", () => {
    expect(codeUsable({ issuedAt: null, tries: 0, now: issued })).toBe(false);
  });
});

describe("readDecisions", () => {
  const form = (entries: [string, string][]) => {
    const f = new Map<string, string>(entries);
    return (k: string) => f.get(k) ?? null;
  };

  it("authorises ticked payments and holds unticked ones that give a reason", () => {
    const d = readDecisions(["a", "b", "c"], form([
      ["ok_a", "on"], ["terms_a", "ta"],
      ["reason_b", "No invoice"], ["terms_b", "tb"],
      ["terms_c", "tc"],
    ]));
    expect(d).toEqual([
      { id: "a", terms: "ta", decision: "authorised", reason: null },
      { id: "b", terms: "tb", decision: "held", reason: "No invoice" },
    ]);
  });
});

describe("auditBlockReason", () => {
  it("lets the books go when every payment is authorised", () => {
    expect(auditBlockReason([])).toBeNull();
  });

  it("names the vouchers still waiting on the head", () => {
    const why = auditBlockReason(["3", "7", "12"]);
    expect(why).toMatch(/3 payments/);
    expect(why).toMatch(/VR 3, 7, 12/);
  });
});

describe("voucherAuthorisationText", () => {
  it("says plainly when a payment is not authorised", () => {
    expect(voucherAuthorisationText(undefined)).toMatch(/not authorised/i);
    expect(voucherAuthorisationText({ state: "changed" })).toMatch(/amended after it was authorised/i);
  });

  it("gives the head's line when authorised", () => {
    expect(voucherAuthorisationText({ state: "authorised", record: rec() })).toMatch(/^Authorised by Jane Otieno/);
  });
});
