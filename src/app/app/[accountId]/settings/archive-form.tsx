"use client";

import { useActionState, useState } from "react";
import { archiveBookAction } from "./actions";

export function ArchiveForm({
  accountId, schoolName, entries,
}: {
  accountId: string;
  schoolName: string;
  entries: number;
}) {
  const [error, action, pending] = useActionState(archiveBookAction, null);
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === schoolName.trim().toLowerCase();

  return (
    <form action={action} className="card" style={{ maxWidth: 720, borderColor: "var(--alarm)" }}>
      <input type="hidden" name="accountId" value={accountId} />

      <p className="note" style={{ marginTop: 0 }}>
        Archiving takes this book out of your list and out of every report. Nothing is destroyed:
        its {entries} entr{entries === 1 ? "y" : "ies"}, months and vote heads stay exactly as they
        are, and it can be brought back from <a href="/app/new">Create the book</a>. A book that has
        been opened stays on the record, so archiving is not a way to un-open one.
      </p>

      <label className="field" style={{ marginTop: "1.25rem" }}>
        Type <strong>{schoolName}</strong> to confirm
        <input
          name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)}
          placeholder={schoolName} autoComplete="off"
        />
      </label>

      <button type="submit" className="btn btn-quiet" disabled={pending || !matches}
        style={matches ? { borderColor: "var(--alarm)", color: "var(--alarm)" } : undefined}>
        {pending ? "Archiving…" : "Archive this book"}
      </button>

      {error && <p className="error">{error}</p>}
    </form>
  );
}
