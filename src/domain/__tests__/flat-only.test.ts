import { describe, expect, it } from "vitest";
import { flatOnlyHeadCodes } from "../vote-heads";

describe("flatOnlyHeadCodes", () => {
  it("is the heads the circular funds per school, not per learner", () => {
    expect(flatOnlyHeadCodes("junior", "TUITION")).toEqual(["TGR"]);
  });

  it("finds every flat head in junior operations", () => {
    expect(flatOnlyHeadCodes("junior", "OPERATIONS")).toEqual(["TEL", "EWC", "INT", "PER"]);
  });

  it("is empty where the same code carries a rate per learner", () => {
    // TGR is 31.28 a learner in the primary chart, so it must stay open there.
    expect(flatOnlyHeadCodes("primary", "TUITION")).toEqual([]);
  });

  it("is empty for a chart with no flat grants at all", () => {
    expect(flatOnlyHeadCodes("senior", "TUITION")).toEqual([]);
  });

  it("is empty for an account that does not exist at that level", () => {
    expect(flatOnlyHeadCodes("senior", "LUNCH")).toEqual([]);
  });
});
