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
