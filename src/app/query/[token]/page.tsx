import type { Metadata } from "next";
import { queryForToken } from "@/server/audit-queries";
import { AnswerForm } from "./form";

export const metadata: Metadata = { title: "Audit query", robots: { index: false } };

const when = (d: Date) =>
  d.toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });

/**
 * The head of institution's view of one audit query, from an emailed link.
 * The head answers here when the query is addressed to them; otherwise they
 * have it to read.
 */
export default async function QueryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await queryForToken(token);

  return (
    <main className="wrap" style={{ padding: "2.5rem 1rem 5rem", maxWidth: 760, margin: "0 auto" }}>
      <div className="eyebrow" style={{ color: "var(--gold)" }}>Zaroda Books</div>
      {!found ? (
        <>
          <h1>This query is closed</h1>
          <p className="sub">The auditor has settled it, so nothing more is needed. The link no longer opens it.</p>
        </>
      ) : (
        <>
          <h1>Audit query</h1>
          <p className="sub">
            {found.book.school.name} — {found.book.account.name}{found.book.fyLabel ? `, FY ${found.book.fyLabel}` : ""}.
            {found.query.addressedTo === "hoi"
              ? ` The auditor asks for your answer, ${found.link.hoiName}, as head of institution.`
              : " For your information, as head of institution. Whoever keeps the books will answer it."}
          </p>

          <div className="card" style={{ marginBottom: "1.35rem" }}>
            <div style={{ fontWeight: 600 }}>⚑ {found.query.subject}</div>
            {found.docs.length > 0 && (
              <p className="note" style={{ margin: ".4rem 0 0" }}>
                Documents on this payment:{" "}
                {found.docs.map((d, i) => (
                  <span key={d.id}>{i > 0 && ", "}{d.blobPath
                    ? <a href={`/query/${token}/documents/${d.id}`} target="_blank" rel="noreferrer">{d.kind}</a>
                    : `${d.kind} (on paper file)`}</span>
                ))}
              </p>
            )}
            {found.messages.map((m) => (
              <div key={m.id} style={{ marginTop: ".75rem", paddingLeft: ".8rem", borderLeft: `3px solid ${m.fromAuditor ? "var(--ink)" : "var(--gold)"}` }}>
                <div className="note">
                  {m.fromAuditor ? "Auditor" : m.fromHoi ? "Head of institution" : "School"} · {m.name} · {when(m.at)}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))}
          </div>

          {found.query.addressedTo === "hoi" && found.query.status === "open" && (
            <AnswerForm token={token} sentTo={found.link.sentTo} />
          )}
          {found.query.addressedTo === "hoi" && found.query.status === "answered" && (
            <p className="note">You have answered. It is with the auditor now; you will be emailed if they reply.</p>
          )}
        </>
      )}
    </main>
  );
}
