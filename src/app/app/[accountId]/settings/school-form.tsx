"use client";

import { useActionState } from "react";
import { saveSchoolAction } from "./actions";

export function SchoolForm({
  accountId, name, locked,
}: {
  accountId: string;
  name: string;
  /** Entries have been posted, so the name is the school's settled identity. */
  locked: boolean;
}) {
  const [message, action, pending] = useActionState(saveSchoolAction, null);

  return (
    <form action={action} className="card" style={{ maxWidth: 720 }}>
      <input type="hidden" name="accountId" value={accountId} />

      <label className="field">Name of school
        <input name="schoolName" defaultValue={name} required disabled={locked} />
      </label>

      <button type="submit" className="btn btn-primary" disabled={pending || locked}>
        {pending ? "Saving…" : "Save"}
      </button>

      <p className="note" style={{ marginTop: "1rem" }}>
        {locked
          ? "This school's books hold posted entries, so its name is fixed. The name is how the "
            + "school is recognised across its books and how its subscription is held, so it "
            + "cannot be moved to a different school once the books are in use. Correcting the "
            + "spelling is still possible before the first entry."
          : "Spell it the same way for every book of this school, so they share one school and one "
            + "subscription. Once entries are posted the name is fixed."}
      </p>

      {message && <p className={message === "Saved." ? "verdict ok" : "error"}>{message}</p>}
    </form>
  );
}
