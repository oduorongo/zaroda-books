import type { VoteHead } from "./types";

export type AccountType =
  | "SIMBA" | "GPA" | "OPERATIONS" | "TUITION" | "INFRASTRUCTURE" | "BOARDING" | "LUNCH";

const heads = (...names: [string, string][]): VoteHead[] =>
  names.map(([code, name], i) => ({ code, name, order: i + 1 }));

/** Seeded from the workbooks. Schools may add heads; they may never renumber these. */
export const CHART_OF_ACCOUNTS: Record<AccountType, VoteHead[]> = {
  SIMBA: heads(
    ["TXB", "Textbooks and readers"], ["TXM", "Textbook maintenance"],
    ["EXB", "Exercise books"], ["TGR", "Teachers guides and reference materials"],
    ["STN", "Stationery"], ["BCH", "Bank charges"],
  ),
  GPA: heads(
    ["RMI", "Repairs, maintenance and improvement"], ["ADM", "Administration costs"],
    ["ACT", "Activity"], ["LTT", "Local travel and transport"],
    ["EWC", "Electricity, water and conservancy"], ["QAS", "Quality assurance"],
    ["CON", "Contingency"], ["BCH", "Bank charges"],
  ),
  OPERATIONS: heads(
    ["OTV", "Other votes"], ["RMI", "Repairs, maintenance and improvement"],
    ["ADM", "Administration costs"], ["ACT", "Activity"],
    ["LTT", "Local travel and transport"], ["MED", "Medical insurance"],
    ["BCH", "Bank charges"], ["ERR", "Erroneous deposit"],
  ),
  TUITION: heads(
    ["LAB", "Laboratory"], ["MFP", "Materials for practicals"],
    ["ASS", "Assessment"], ["STN", "Stationery"],
    ["RMB", "Reference materials"], ["BCH", "Bank charges"],
  ),
  INFRASTRUCTURE: heads(
    ["CIV", "Civil works"], ["FUR", "Furniture and equipment"],
    ["PRO", "Professional fees"], ["BCH", "Bank charges"],
  ),
  BOARDING: heads(
    ["BES", "Boarding, equipment and stores"], ["RMI", "Repairs, maintenance and improvement"],
    ["OTV", "Other votes"], ["BUR", "Bursary"], ["PER", "Personal emoluments"],
    ["BUS", "School bus"], ["LTT", "Local travel and transport"],
    ["EWC", "Electricity, water and conservancy"], ["MED", "Medical"],
    ["ADM", "Administration costs"], ["BCH", "Bank charges"], ["REF", "Refunds"],
  ),
  LUNCH: heads(["FOD", "Food"], ["FUE", "Fuel"], ["LAB2", "Labour"], ["BCH", "Bank charges"]),
};
