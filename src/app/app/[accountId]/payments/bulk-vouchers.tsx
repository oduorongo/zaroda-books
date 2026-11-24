"use client";

import { useEffect, useState } from "react";
import { PdfButton } from "../pdf-button";

export const BULK_FORM = "bulk-vouchers";
const MAX = 300;

/** Ticks one payment in the table for "Download ticked vouchers". */
export function VoucherTick({ id }: { id: string }) {
  return <input type="checkbox" className="no-print" form={BULK_FORM} name="v" value={id} aria-label="Tick this voucher" />;
}

/**
 * Many vouchers in one PDF, one per page: the payments ticked in the table, or every voucher dated within a range.
 * The ticks live in the table rows (linked by the form id), so the table itself stays a server component.
 */
export function BulkVouchers({ accountId, fyStart, fyEnd, slug }: {
  accountId: string; fyStart: string; fyEnd: string; slug: string;
}) {
  const [ticked, setTicked] = useState<string[]>([]);
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(fyEnd);

  useEffect(() => {
    const read = () => setTicked(Array.from(document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM}"]:checked`)).map((i) => i.value));
    document.addEventListener("change", read);
    read();
    return () => document.removeEventListener("change", read);
  }, []);

  const setAll = (on: boolean) => {
    document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM}"]`).forEach((i) => { i.checked = on; });
    setTicked(on ? Array.from(document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM}"]`)).map((i) => i.value) : []);
  };

  const base = `/app/${accountId}/payments/vouchers/export`;
  const tooMany = ticked.length > MAX;
  return (
    <form id={BULK_FORM} className="no-print" onSubmit={(e) => e.preventDefault()}
      style={{ display: "flex", gap: ".8rem 1.4rem", alignItems: "center", flexWrap: "wrap", margin: "0 0 1rem" }}>
      <span style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-quiet" onClick={() => setAll(ticked.length === 0)}>
          {ticked.length === 0 ? "Tick all shown" : "Clear ticks"}
        </button>
        <PdfButton
          href={`${base}?ids=${ticked.join(",")}`}
          disabled={ticked.length === 0 || tooMany}
          label={`Download ticked vouchers (${ticked.length})`}
          filename={`${slug}-vouchers-selected`}
        />
        {tooMany && <span className="note">Up to {MAX} at a time — use dates for more.</span>}
      </span>
      <span style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
        <label className="note">From <input type="date" value={from} min={fyStart} max={fyEnd} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="note">to <input type="date" value={to} min={fyStart} max={fyEnd} onChange={(e) => setTo(e.target.value)} /></label>
        <PdfButton
          href={`${base}?from=${from}&to=${to}`}
          disabled={!from || !to || from > to}
          label="Download vouchers for these dates"
          filename={`${slug}-vouchers-${from}-to-${to}`}
        />
      </span>
    </form>
  );
}
