"use client";

import { useActionState, useState } from "react";
import { FileInput } from "../file-input";
import { attachStatementAction, removeStatementAction } from "./actions";

export interface StatementView {
  id: string;
  kind: "statement" | "certificate";
  covers: string;
  fileName: string;
  addedOn: string;
  removable: boolean;
}

/**
 * The bank's own statements for this book, beside the balance typed from
 * them. One file may cover one month or the whole year, as the bank issued it.
 */
export function BankStatements({ accountId, statements, missing, yearEnd, months, month, canAttach }: {
  accountId: string;
  statements: StatementView[];
  /** Names of the months no statement covers. */
  missing: string[];
  /** The year's last month, whose statement alone is required before the year-end audit. */
  yearEnd: { name: string; missing: boolean };
  months: { value: string; label: string }[];
  /** The month being viewed, "yyyy-mm", which a new statement starts from. */
  month: string;
  canAttach: boolean;
}) {
  const [error, attach, pending] = useActionState(attachStatementAction, null);
  const [kind, setKind] = useState("statement");

  return (
    <div className="card" style={{ marginTop: "1.6rem" }}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Bank statements</h2>
      {statements.length === 0 && <p className="note">None attached yet.</p>}
      <ul style={{ margin: "0 0 .8rem", paddingLeft: "1.1rem" }}>
        {statements.map((s) => (
          <li key={s.id} style={{ margin: ".3rem 0" }}>
            <strong>{s.kind === "certificate" ? "Certificate of balance" : "Statement"}</strong>, {s.covers}{" — "}
            <a href={`/app/${accountId}/bank-reconciliation/statements/${s.id}`} target="_blank" rel="noreferrer">{s.fileName}</a>
            <span className="note"> · added {s.addedOn}</span>
            {s.removable && <Remove accountId={accountId} statementId={s.id} />}
          </li>
        ))}
      </ul>
      <p className={!missing.length ? "verdict ok" : yearEnd.missing ? "error" : "note"} style={{ margin: "0 0 1rem" }}>
        {!missing.length ? "Every month of the year is covered by a statement."
          : `No statement yet for ${missing.join(", ")}. ` + (yearEnd.missing
            ? `The ${yearEnd.name} statement is required before the year-end audit; the others the auditor may ask for.`
            : `Only the ${yearEnd.name} statement is required; the auditor may ask for these.`)}
      </p>

      {canAttach && (
        <form action={attach} className="no-print" style={{ display: "grid", gap: ".6rem", maxWidth: 560 }}>
          <input type="hidden" name="accountId" value={accountId} />
          <label className="field">What it is
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="statement">Bank statement</option>
              <option value="certificate">Certificate of balance at the year end (optional)</option>
            </select>
          </label>
          {kind === "statement" && (
            <div className="grid-2">
              <label className="field">Covers from
                <select name="from" defaultValue={month}>
                  {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>
              <label className="field">To
                <select name="to" defaultValue={month}>
                  {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>
            </div>
          )}
          <FileInput name="file" required />
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ justifySelf: "start" }}>
            {pending ? "Attaching…" : "Attach"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  );
}

function Remove({ accountId, statementId }: { accountId: string; statementId: string }) {
  const [error, action, pending] = useActionState(removeStatementAction, null);
  return (
    <form action={action} className="no-print" style={{ display: "inline", marginLeft: ".6rem" }}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="statementId" value={statementId} />
      <button type="submit" className="btn-link note" disabled={pending}
        onClick={(e) => { if (!confirm("Remove this statement?")) e.preventDefault(); }}>
        Remove
      </button>
      {error && <span className="error"> {error}</span>}
    </form>
  );
}
