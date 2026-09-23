"use server";

import { revalidatePath } from "next/cache";
import { saveLetterDetails } from "@/server/capitation-letter";

export async function saveLetterDetailsAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const text = (name: string) => String(form.get(name) ?? "").trim();

  try {
    await saveLetterDetails({
      accountId,
      details: {
        shortName: text("shortName"),
        postalAddress: text("postalAddress"),
        town: text("town"),
        scdeAddress: text("scdeAddress"),
        scdeTown: text("scdeTown"),
        ministryName: text("ministryName"),
        ministryAddress: text("ministryAddress"),
        ministryEmail: text("ministryEmail"),
        signatoryName: text("signatoryName"),
        signatoryTitle: text("signatoryTitle"),
      },
      banks: form.getAll("bookId").map((id) => ({
        accountId: String(id),
        number: text(`number-${id}`),
        bankName: text(`bankName-${id}`),
        bankBranch: text(`bankBranch-${id}`),
      })),
    });
  } catch (e) {
    return e instanceof Error ? e.message : "The details could not be saved.";
  }

  revalidatePath(`/app/${accountId}/capitation-letter`);
  return "Saved.";
}
