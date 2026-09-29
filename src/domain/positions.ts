/**
 * What a person is, chosen once at signup: the head of institution, the
 * bursar, an auditor or a freelance accountant.
 *
 * Not a permission. What someone may post or delete is their membership role
 * (see permissions.ts) — a freelancer and a head who both sign up are each the
 * owner of their own books. The position decides what they are shown, and
 * only the system owner can change it afterwards.
 *
 * Choosing "auditor" grants nothing: reading a county's books still needs a
 * grant from the console, or anyone could pick it and read every school.
 */

export const POSITIONS = ["hoi", "bursar", "auditor", "freelancer"] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABEL: Record<Position, string> = {
  hoi: "Head of institution",
  bursar: "Bursar",
  auditor: "Auditor",
  freelancer: "Freelance accountant",
};

/**
 * The letter goes out over the head's signature. The school's own officers
 * prepare it, and so does the freelance accountant who keeps its books; the
 * head still signs what is printed. An auditor never does.
 */
export const seesCapitationLetter = (position: Position | null): boolean =>
  position === "hoi" || position === "bursar" || position === "freelancer";
