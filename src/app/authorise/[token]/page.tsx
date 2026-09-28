import type { Metadata } from "next";
import { requestForToken } from "@/server/authorisation";
import { documentsFor } from "@/server/documents";
import { decisionRow } from "../../decision-table";
import { AuthoriseForm } from "./form";

export const metadata: Metadata = { title: "Authorise payments", robots: { index: false } };

/**
 * The head of institution's page, reached from the emailed link. No account
 * is needed: the link and a code sent to the same address are the credential.
 */
export default async function AuthorisePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await requestForToken(token);
  const docs = await documentsFor(found?.payments.map((s) => s.payment.id) ?? []);

  return (
    <main className="wrap" style={{ padding: "2.5rem 1rem 5rem", maxWidth: 900, margin: "0 auto" }}>
      <div className="eyebrow" style={{ color: "var(--gold)" }}>Zaroda Books</div>
      {!found ? (
        <>
          <h1>This link is no longer usable</h1>
          <p className="sub">
            A link works once and lapses after seven days. Ask whoever keeps the school&apos;s books to send the payments again.
          </p>
        </>
      ) : (
        <>
          <h1>Payments for your authorisation</h1>
          <p className="sub">
            {found.school.name} — {found.account.name} account, FY {found.fy.label}.
            For {found.req.hoiName}, head of institution. Untick any payment you do not authorise and give your reason.
          </p>
          {found.payments.length === 0 ? (
            <p className="note">These payments have since been removed or already decided.</p>
          ) : (
            <AuthoriseForm
              token={token}
              sentTo={found.req.sentTo ?? ""}
              rows={found.payments.map((s) => decisionRow(s.payment, s.terms, (docs.get(s.payment.id) ?? []).map((d) => ({
                label: d.kind, href: d.blobPath ? `/authorise/${token}/documents/${d.id}` : null,
              }))))}
            />
          )}
        </>
      )}
    </main>
  );
}
