import type { ClearanceContent, ClearanceData } from "@/server/audit-reports";

/**
 * The audit clearance of a head of institution leaving a school, as an
 * internal memo. No crest, signature or stamp is drawn: the auditor signs and
 * stamps the printed copy.
 */

const REASON_CLAUSE: Record<string, string> = {
  retirement: "who is retiring",
  transfer: "who is on transfer",
  promotion: "who has been promoted",
  resignation: "who has resigned",
};

/** "2026-06-30" -> "30th June, 2026", as the memos are dated. */
export function longDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(`${iso}T00:00:00Z`) : iso;
  const day = d.getUTCDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  const month = d.toLocaleDateString("en-KE", { month: "long", timeZone: "UTC" });
  return `${day}${suffix} ${month}, ${d.getUTCFullYear()}`;
}

export function ClearanceMemo({ data, memo, periodTo, issuedAt }: {
  data: ClearanceData; memo: ClearanceContent; periodTo: string | null; issuedAt: Date | null;
}) {
  const rows: [string, string][] = [
    ["To", memo.addressee],
    ["From", memo.from],
    ["Date", issuedAt ? longDate(issuedAt) : "...................................."],
    ["Ref", memo.reference || "...................................."],
  ];
  const copies = memo.copyTo.split(/\n+/).map((c) => c.trim()).filter(Boolean);

  return (
    <article style={{ maxWidth: 720, margin: "0 auto" }}>
      <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <div style={{ fontWeight: 600, letterSpacing: ".04em" }}>REPUBLIC OF KENYA</div>
        <h1 style={{ margin: ".4rem 0 .2rem" }}>MINISTRY OF EDUCATION</h1>
        <div style={{ fontWeight: 600 }}>STATE DEPARTMENT FOR BASIC EDUCATION</div>
        <div style={{ fontWeight: 600, marginTop: "1rem", textDecoration: "underline" }}>INTERNAL MEMO</div>
        {!issuedAt && <p className="error no-print">Draft. The date is filled in when you issue the memo.</p>}
      </header>

      <table style={{ borderTop: "3px solid var(--ink)", borderBottom: "3px solid var(--ink)", marginBottom: "1.5rem" }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}><td style={{ width: "7rem", fontWeight: 600 }}>{k.toUpperCase()}</td><td style={{ width: "1.5rem" }}>:</td><td>{v}</td></tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontWeight: 600, textDecoration: "underline", textTransform: "uppercase" }}>
        Audit clearance of {memo.officer || "[name of head of institution]"} – TSC {memo.tscNo || "[number]"}
      </p>
      <p style={{ lineHeight: 1.8, textAlign: "justify" }}>
        This is to inform you that the above-mentioned head of institution, {REASON_CLAUSE[memo.reason] ?? REASON_CLAUSE.retirement},
        has been cleared by the County Audit Office for finances incurred during the tenure as the accounting
        officer of <strong style={{ textTransform: "uppercase" }}>{data.school}</strong> for the years up
        to <strong>{periodTo ? longDate(periodTo) : "[date]"}</strong>.
      </p>
      <p>Thank you.</p>

      <div style={{ marginTop: "3rem" }}>
        ....................................................<br />
        <strong>{data.auditor}</strong><br />
        For: {memo.from}
        <div className="note" style={{ marginTop: ".4rem" }}>Official stamp</div>
      </div>

      {copies.length > 0 && (
        <div style={{ display: "flex", gap: "1rem", marginTop: "2.5rem" }}>
          <strong>Copy to:</strong>
          <div>{copies.map((c) => <div key={c} style={{ marginBottom: ".5rem" }}><em>{c}</em></div>)}</div>
        </div>
      )}
    </article>
  );
}
