"use client";

import { useActionState } from "react";
import { DOCUMENT_KINDS } from "@/domain";
import { FileInput } from "../file-input";
import { attachDocumentAction, removeDocumentAction } from "./actions";

export interface DocumentView {
  id: string;
  kind: string;
  fileName: string | null;
  onPaper: boolean;
  addedOn: string;
}

/**
 * What the payment rests on. Anyone reading the book sees the list; whoever
 * keeps the books attaches, and removes while the month is open.
 */
export function PaymentDocuments({ accountId, transactionId, docs, canAttach, canRemove }: {
  accountId: string; transactionId: string; docs: DocumentView[]; canAttach: boolean; canRemove: boolean;
}) {
  const [error, attach, pending] = useActionState(attachDocumentAction, null);

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h2>Supporting documents</h2>
      {docs.length === 0 && <p className="note">None attached.</p>}
      <ul style={{ margin: "0 0 1rem", paddingLeft: "1.1rem" }}>
        {docs.map((d) => (
          <li key={d.id} style={{ margin: ".3rem 0" }}>
            <strong>{d.kind}</strong>{" — "}
            {d.onPaper ? "on the paper file" : (
              <a href={`/app/${accountId}/documents/${d.id}`} target="_blank" rel="noreferrer">{d.fileName}</a>
            )}
            <span className="note"> · added {d.addedOn}</span>
            {canRemove && <Remove accountId={accountId} documentId={d.id} />}
          </li>
        ))}
      </ul>
      {canAttach && (
        <form action={attach} className="no-print" style={{ display: "grid", gap: ".6rem", maxWidth: 520 }}>
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="transactionId" value={transactionId} />
          <label className="field">What it is
            <select name="kind" defaultValue="Receipt">
              {DOCUMENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <FileInput name="file" />
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <input type="checkbox" name="onPaper" /> The original is on the paper file only
          </label>
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ justifySelf: "start" }}>
            {pending ? "Attaching…" : "Attach"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  );
}

function Remove({ accountId, documentId }: { accountId: string; documentId: string }) {
  const [error, action, pending] = useActionState(removeDocumentAction, null);
  return (
    <form action={action} className="no-print" style={{ display: "inline", marginLeft: ".6rem" }}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="documentId" value={documentId} />
      <button type="submit" className="btn-link note" disabled={pending}
        onClick={(e) => { if (!confirm("Remove this document from the payment?")) e.preventDefault(); }}>
        Remove
      </button>
      {error && <span className="error"> {error}</span>}
    </form>
  );
}
