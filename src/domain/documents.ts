/**
 * Supporting documents: what a payment rests on, and the SCDE approval an
 * infrastructure project rests on.
 *
 * Documents on a payment are optional — many originals stay in the paper
 * file — so a gap only warns. The SCDE approval is not optional: no payment
 * is made for a project until its letter is attached.
 */

export const DOCUMENT_KINDS = [
  "Receipt", "Invoice", "Delivery note", "LPO/LSO", "Inspection & acceptance certificate", "Quotations", "SCDE approval", "Other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Under the 4.5 MB a request may carry on the host; photos are shrunk well below it first. */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const ACCEPTED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

export function documentProblem(f: { type: string; size: number }): string | null {
  if (f.size <= 0) return "That file is empty.";
  if (!ACCEPTED.test(f.type)) return "Attach a photo or a PDF.";
  if (f.size > MAX_DOCUMENT_BYTES) return "That file is over 4 MB. Scan it at a lower quality, or photograph it instead.";
  return null;
}

/** A project is known by its name as typed on the receipts, spelt however. */
export const projectKey = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Why an infrastructure payment cannot be posted, or null. Exempt books went
 * for audit before this rule and keep their entries as they were.
 */
export function infrastructurePaymentProblem(p: {
  takesProject: boolean; exempt: boolean; project: string; letterAttached: boolean;
}): string | null {
  if (!p.takesProject || p.exempt) return null;
  if (!p.project.trim()) return "Choose which project this payment is for.";
  if (!p.letterAttached) {
    return `The SCDE approval for ${p.project.trim()} is not attached. Attach it under Projects before paying for the project.`;
  }
  return null;
}

/** Why an infrastructure book cannot go for audit, from its payments lacking an approved project. */
export function scdeAuditBlock(unapproved: { vrNo: string; project: string | null }[]): string | null {
  if (!unapproved.length) return null;
  const list = unapproved.map((u) => `VR ${u.vrNo} (${u.project ?? "no project named"})`).join(", ");
  return `These payments have no attached SCDE approval for their project: ${list}.`;
}

export function missingDocumentsWarning(vrNos: string[]): string | null {
  if (!vrNos.length) return null;
  const n = vrNos.length;
  return `${n} payment${n === 1 ? " has" : "s have"} no supporting documents: VR ${vrNos.join(", ")}. `
    + "You can still send the books; the auditor will see the gap.";
}
