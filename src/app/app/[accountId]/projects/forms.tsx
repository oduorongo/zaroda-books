"use client";

import { useActionState } from "react";
import { FileInput } from "../file-input";
import { attachLetterAction, removeLetterAction } from "./actions";

export function AttachLetter({ accountId, project }: { accountId: string; project: string }) {
  const [error, action, pending] = useActionState(attachLetterAction, null);
  return (
    <form action={action} style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="project" value={project} />
      <FileInput name="file" required />
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Attaching…" : "Attach approval"}</button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}

export function RemoveLetter({ accountId, letterId }: { accountId: string; letterId: string }) {
  const [error, action, pending] = useActionState(removeLetterAction, null);
  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="letterId" value={letterId} />
      <button type="submit" className="btn-link note" disabled={pending}
        onClick={(e) => { if (!confirm("Remove this SCDE approval?")) e.preventDefault(); }}>
        Remove
      </button>
      {error && <span className="error"> {error}</span>}
    </form>
  );
}
