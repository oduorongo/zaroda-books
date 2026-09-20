import Link from "next/link";
import {
  LEVEL_PRICE, financialYearInProgress, financialYearLabels, formatKes, revenue,
} from "@/domain";
import { getTenant } from "@/server/platform";
import { viewAsAction } from "./actions";
import {
  ApproveButton, NewSubscriptionForm, PaidToggle, UnbindForm,
} from "./subscription-forms";

const stamp = (d: Date | null) =>
  d ? new Date(d).toLocaleString("en-KE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function TenantPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { org, members, schools, books, subs, audit, payments } = await getTenant(orgId);
  const money = revenue(subs.map((s) => ({
    level: s.subscription.level, paidAt: s.subscription.paidAt, isFree: s.subscription.isFree,
  })));
  // Back to 2023/24: a book keeper taking on a school writes up its back
  // years, and those years still need subscribing to.
  const years = financialYearLabels(financialYearInProgress() + 1, 2023);

  return (
    <>
      <Link href="/admin" className="back-link">← All tenants</Link>
      <div className="report-bar">
        <div>
          <h1>{org.name}</h1>
          <p className="sub">
            Joined {stamp(org.createdAt)} · KSh {formatKes(money.collected)} collected,
            KSh {formatKes(money.outstanding)} outstanding
          </p>
          {!org.approvedAt && (
            <p style={{ color: "var(--alarm)", fontSize: ".9rem", margin: "-1.25rem 0 0", maxWidth: "58ch" }}>
              Awaiting review. Their free school is held back until you approve. Check first
              whether this is the same person as an org already on the list.
            </p>
          )}
        </div>
        <div className="report-actions">
          <ApproveButton orgId={org.id} approved={Boolean(org.approvedAt)} />
          <form action={viewAsAction}>
            <input type="hidden" name="orgId" value={org.id} />
            <button type="submit" className="btn btn-quiet">Open their books, read only</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>People</div>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user.id}>
                <td>{m.user.name}</td>
                <td>{m.user.email}</td>
                <td>{m.user.phone ?? "—"}</td>
                <td>{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>Subscriptions</div>
        <table>
          <thead>
            <tr>
              <th>Year</th><th>Level</th><th className="n">Price</th>
              <th>Bound to</th><th>Paid</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subs.map(({ subscription: s, school }) => (
              <tr key={s.id}>
                <td>{s.fyLabel}</td>
                <td>{s.level}</td>
                <td className="n">{s.isFree ? <span className="zero">free</span> : formatKes(LEVEL_PRICE[s.level])}</td>
                <td>
                  {school ? school.name : <span className="zero">not yet bound</span>}
                  {s.boundAt && <div className="note">{stamp(s.boundAt)}</div>}
                </td>
                <td style={{ color: s.isFree ? "var(--muted)" : s.paidAt ? "var(--gold)" : "var(--alarm)" }}>
                  {s.isFree ? "the free school" : s.paidAt ? stamp(s.paidAt) : "unpaid"}
                </td>
                <td>
                  {/* Marking the free school paid would be recording money that was
                      never owed, so the toggle is not offered on it. */}
                  {!s.isFree && (
                    <PaidToggle orgId={org.id} subscriptionId={s.id} paid={Boolean(s.paidAt)} />
                  )}
                  {school && (
                    <UnbindForm orgId={org.id} subscriptionId={s.id} schoolName={school.name} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subs.length === 0 && <p className="note">Nothing sold to this org yet.</p>}
        <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--rule-soft)", paddingTop: "1rem" }}>
          <NewSubscriptionForm orgId={org.id} years={years} />
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: "1.35rem" }}>
        <div className="card">
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>Schools</div>
          <table>
            <thead><tr><th>Name</th><th>Level</th><th>County</th></tr></thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}<div className="note mono">{s.nameKey}</div></td>
                  <td>{s.level}</td>
                  <td>{s.county ? `${s.county}${s.subCounty ? ` · ${s.subCounty}` : ""}` : <span className="zero">not set</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>Books</div>
          <table>
            <thead><tr><th>School</th><th>Account</th><th>State</th></tr></thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.account.id}>
                  <td>{b.school.name}</td>
                  <td>{b.account.name}</td>
                  <td>{b.account.archivedAt ? <span className="zero">archived</span> : "open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
          M-Pesa payments
        </div>
        <table>
          <thead>
            <tr>
              <th>When</th><th>For</th><th className="n">Amount</th>
              <th>Phone</th><th>M-Pesa receipt</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{stamp(p.createdAt)}</td>
                <td style={{ textTransform: "capitalize" }}>{p.level} {p.fyLabel}</td>
                <td className="n">{formatKes(p.amount)}</td>
                <td className="mono">{p.phone}</td>
                <td className="mono">{p.mpesaReceipt ?? "—"}</td>
                <td style={{ color: p.status === "success" ? "var(--gold)" : p.status === "failed" ? "var(--alarm)" : "var(--muted)" }}>
                  {p.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && <p className="note">No M-Pesa payment has been attempted.</p>}
      </div>

      <div className="card">
        <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
          Last 50 audit entries
        </div>
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th></tr></thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.row.id}>
                <td>{stamp(a.row.at)}</td>
                <td>{a.userName ?? "—"}</td>
                <td className="mono" style={{ fontSize: ".8rem" }}>{a.row.action}</td>
                <td>{a.row.entity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {audit.length === 0 && <p className="note">Nothing logged yet.</p>}
      </div>
    </>
  );
}
