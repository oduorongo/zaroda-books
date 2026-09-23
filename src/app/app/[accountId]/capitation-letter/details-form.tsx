"use client";

import { useActionState } from "react";
import type { LetterDetails } from "@/domain";
import { saveLetterDetailsAction } from "./actions";

export interface BookBank {
  id: string;
  name: string;
  number: string;
  bankName: string;
  bankBranch: string;
}

export function LetterDetailsForm({ accountId, details, books, locked }: {
  accountId: string;
  details: LetterDetails;
  books: BookBank[];
  /** A viewer reads the letter but cannot change what it carries. */
  locked: boolean;
}) {
  const [message, action, pending] = useActionState(saveLetterDetailsAction, null);

  const field = (label: string, name: keyof LetterDetails, placeholder = "") => (
    <label className="field">{label}
      <input name={name} defaultValue={details[name]} placeholder={placeholder} disabled={locked} />
    </label>
  );

  return (
    <form action={action} className="stack">
      <input type="hidden" name="accountId" value={accountId} />

      <div className="eyebrow">The school</div>
      <div className="grid-2">
        {field("Postal address", "postalAddress", "P.O. BOX 250-50100")}
        {field("Town", "town", "KAKAMEGA")}
      </div>
      {field("Short name for the letter body (optional)", "shortName", "Mwangaza JS")}

      <div className="eyebrow">Sub-County Director of Education</div>
      <p className="note" style={{ margin: 0 }}>
        {details.subCounty
          ? `${details.subCounty} sub-county, from the school's settings.`
          : "The school has no sub-county yet. The owner of these books sets it in Book settings."}
      </p>
      <div className="grid-2">
        {field("Postal address", "scdeAddress", "P.O. BOX 12-50100")}
        {field("Town", "scdeTown", "KAKAMEGA")}
      </div>

      <div className="eyebrow">Signed by</div>
      <div className="grid-2">
        {field("Name", "signatoryName", "Jane Wanjiru")}
        {field("Title", "signatoryTitle", "Principal")}
      </div>

      <div className="eyebrow">Bank accounts</div>
      {books.map((b) => (
        <div key={b.id}>
          <input type="hidden" name="bookId" value={b.id} />
          <div style={{ fontWeight: 500, marginBottom: ".35rem" }}>{b.name}</div>
          <div className="grid-2">
            <label className="field">Account number
              <input name={`number-${b.id}`} defaultValue={b.number} disabled={locked} />
            </label>
            <label className="field">Bank
              <input name={`bankName-${b.id}`} defaultValue={b.bankName} placeholder="Equity Bank" disabled={locked} />
            </label>
            <label className="field">Branch
              <input name={`bankBranch-${b.id}`} defaultValue={b.bankBranch} placeholder="Kakamega" disabled={locked} />
            </label>
          </div>
        </div>
      ))}

      <div className="eyebrow">The Ministry</div>
      <label className="field">Ministry and State Department, one per line
        <textarea name="ministryName" rows={2} defaultValue={details.ministryName} disabled={locked} />
      </label>
      <div className="grid-2">
        {field("Postal address", "ministryAddress")}
        {field("Email", "ministryEmail")}
      </div>

      {!locked && (
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </button>
      )}
      {message && <p className={message === "Saved." ? "verdict ok" : "error"}>{message}</p>}
    </form>
  );
}
