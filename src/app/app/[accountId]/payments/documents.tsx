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
            <select name="kind" defaultValue="" required>
              <option value="" disabled>Choose…</option>
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

export interface PendingDocument { kind: string; file: File | null }

/**
 * Documents entered with a new payment. They cannot go in the same request:
 * several photos or PDFs together pass what one request may carry. So they are
 * taken off the form, and attached one by one once the payment is posted.
 */
export function takeDocuments(data: FormData): { docs: PendingDocument[]; error: string | null } {
  const ids = [...data.keys()].filter((k) => k.startsWith("doc_kind_")).map((k) => k.slice("doc_kind_".length));
  const docs: PendingDocument[] = [];
  let error: string | null = null;
  for (const id of ids) {
    const kind = String(data.get(`doc_kind_${id}`) ?? "");
    const file = data.get(`doc_file_${id}`);
    const chosen = file instanceof File && file.size > 0 ? file : null;
    const onPaper = data.get(`doc_paper_${id}`) === "on";
    if (!chosen && !onPaper) {
      if (kind) error ??= `Choose the ${kind.toLowerCase()} to attach, or tick that it is on the paper file.`;
      continue;
    }
    if (!kind) error ??= "Choose what each supporting document is.";
    else docs.push({ kind, file: onPaper ? null : chosen });
  }
  for (const k of [...data.keys()]) if (k.startsWith("doc_")) data.delete(k);
  return { docs, error };
}

/** One document row per id, each optional; more can be added. */
export function DocumentRows({ rows, onAdd, onRemove }: {
  rows: number[]; onAdd: () => void; onRemove: (id: number) => void;
}) {
  return (
    <div style={{ display: "grid", gap: ".75rem" }}>
      {rows.map((id) => (
        <div key={id} style={{ display: "flex", gap: ".75rem", alignItems: "center", flexWrap: "wrap" }}>
          <select name={`doc_kind_${id}`} defaultValue="" aria-label="What the document is" style={{ flex: "0 1 16rem" }}>
            <option value="" disabled>What it is…</option>
            {DOCUMENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <FileInput name={`doc_file_${id}`} />
          <label style={{ display: "flex", gap: ".4rem", alignItems: "center", fontSize: ".86rem" }}>
            <input type="checkbox" name={`doc_paper_${id}`} /> On the paper file only
          </label>
          {rows.length > 1 && (
            <button type="button" className="btn-link note" onClick={() => onRemove(id)}>Remove</button>
          )}
        </div>
      ))}
      <button type="button" className="btn-link" style={{ justifySelf: "start" }} onClick={onAdd}>
        + Add another document
      </button>
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
