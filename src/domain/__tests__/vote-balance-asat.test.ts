import { describe, expect, it } from "vitest";
import { voteBalancesAsAt, type VoteEntry } from "../vote-balance";

/** PITH's LAB vote, as it actually stands in the books. */
const lab: VoteEntry[] = [
  { code: "LAB", date: "2023-09-22", amount: 504_000, isPayment: false },
  { code: "LAB", date: "2023-10-24", amount: 4_000_000, isPayment: true },
  { code: "LAB", date: "2024-01-09", amount: 1_260_000, isPayment: false },
  { code: "LAB", date: "2024-03-27", amount: 1_260_000, isPayment: false },
  { code: "LAB", date: "2024-06-21", amount: 1_416_351, isPayment: false },
];

describe("voteBalancesAsAt", () => {
  it("counts only what had happened by that date", () => {
    // On 24 October the vote had received 5,040 and nothing else. Judging the
    // payment against the whole year's 44,403.51 would say it was funded when
    // it was not.
    expect(voteBalancesAsAt(lab, "2023-10-23").LAB).toBe(504_000);
  });

  it("counts the whole year by the last day of it", () => {
    // 44,403.51 received less 40,000 paid, in cents.
    expect(voteBalancesAsAt(lab, "2024-06-30").LAB).toBe(440_351);
  });

  it("takes payments off and leaves receipts on", () => {
    expect(voteBalancesAsAt(lab, "2024-06-21").LAB).toBe(440_351);
  });

  it("includes entries on the day itself, so a receipt funds a same-day payment", () => {
    const sameDay: VoteEntry[] = [
      { code: "X", date: "2024-05-01", amount: 100_000, isPayment: false },
    ];
    expect(voteBalancesAsAt(sameDay, "2024-05-01").X).toBe(100_000);
  });

  it("is nil for a vote with nothing on it yet", () => {
    expect(voteBalancesAsAt(lab, "2023-09-01").LAB).toBe(0);
  });

  it("keeps vote heads apart", () => {
    const mixed: VoteEntry[] = [
      { code: "LAB", date: "2024-01-01", amount: 500_000, isPayment: false },
      { code: "STN", date: "2024-01-01", amount: 300_000, isPayment: false },
    ];
    const at = voteBalancesAsAt(mixed, "2024-01-01");
    expect(at.LAB).toBe(500_000);
    expect(at.STN).toBe(300_000);
  });

  it("gives every vote a figure, so a missing key never reads as zero by accident", () => {
    expect(voteBalancesAsAt([], "2024-01-01")).toEqual({});
  });

  it("ignores an unreadable date rather than counting everything", () => {
    // A half-typed date in the box must not make the whole year appear.
    expect(voteBalancesAsAt(lab, "").LAB).toBe(0);
  });
});
