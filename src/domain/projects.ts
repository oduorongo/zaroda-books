import type { AccountType } from "./vote-heads";

/**
 * Money into the infrastructure account is transferred for a named project,
 * approved by the SCDE. The school records the project on each receipt so the
 * audit report can set what was transferred beside what was approved and done.
 */
export const takesProject = (type: AccountType): boolean => type === "INFRASTRUCTURE";

export const PROJECT_APPROVALS = ["Approved", "Awaiting approval", "Not approved"] as const;
export const PROJECT_STATUSES = ["Not started", "Ongoing", "Completed"] as const;

export type ProjectApproval = (typeof PROJECT_APPROVALS)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ReceiptProject {
  project: string;
  approval: ProjectApproval;
  status: ProjectStatus;
}

/** Reads the three fields a form sent, or says what is missing. */
export function readProject(
  project: string, approval: string, status: string,
): ReceiptProject | { error: string } {
  if (!project.trim()) return { error: "Name the project this money is for." };
  if (!(PROJECT_APPROVALS as readonly string[]).includes(approval)) return { error: "Choose the SCDE approval." };
  if (!(PROJECT_STATUSES as readonly string[]).includes(status)) return { error: "Choose the project status." };
  return { project: project.trim(), approval: approval as ProjectApproval, status: status as ProjectStatus };
}
