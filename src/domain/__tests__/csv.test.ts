import { describe, expect, it } from "vitest";
import { csvAmount, toCsv } from "../csv";
import { toCents } from "../money";

describe("toCsv", () => {
  it("joins rows with CRLF and fields with commas", () => {
    expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d");
  });

  it("quotes a field holding a comma", () => {
    expect(toCsv([["Repairs, maintenance", "1"]])).toBe('"Repairs, maintenance",1');
  });

  it("doubles an embedded quote", () => {
    expect(toCsv([['He said "no"']])).toBe('"He said ""no"""');
  });

  it("quotes a field holding a newline", () => {
    expect(toCsv([["one\ntwo"]])).toBe('"one\ntwo"');
  });
});

describe("csvAmount", () => {
  it("writes cents as a plain decimal a spreadsheet can add up", () => {
    expect(csvAmount(toCents(274444))).toBe("274444.00");
    expect(csvAmount(toCents(696.97))).toBe("696.97");
    expect(csvAmount(0)).toBe("0.00");
  });
});

describe("toCsv and spreadsheet formulas", () => {
  it("defuses text Excel would run as a formula", () => {
    // A payee, narration or query reply typed as "=HYPERLINK(...)" must
    // open as text on the bursar's or auditor's machine, not run.
    expect(toCsv([["=1+1"]])).toBe("'=1+1");
    expect(toCsv([["+254712345678"]])).toBe("'+254712345678");
    expect(toCsv([["@SUM(A1)"]])).toBe("'@SUM(A1)");
    expect(toCsv([["-cmd"]])).toBe("'-cmd");
  });

  it("still quotes a defused field that needs quoting", () => {
    expect(toCsv([['=HYPERLINK("x","y")']])).toBe('"\'=HYPERLINK(""x"",""y"")"');
  });

  it("leaves amounts as numbers, negatives included", () => {
    expect(toCsv([["-1200.00", -5, "0.00"]])).toBe("-1200.00,-5,0.00");
  });
});
