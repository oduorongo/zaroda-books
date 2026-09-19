import Link from "next/link";
import { formatKes } from "@/domain";
import { listTenants, platformTotals } from "@/server/platform";

const day = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card">
      <div className="eyebrow" style={{ color: "var(--gold)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.9rem", fontWeight: 700, margin: ".5rem 0 .2rem" }}>
        {value}
      </div>
      {note && <div className="note">{note}</div>}
    </div>
  );
}

export default async function AdminPage() {
  const tenants = await listTenants();
  const t = platformTotals(tenants);
  const pending = tenants.filter((x) => !x.approvedAt).length;

  return (
    <>
      <h1>Tenants</h1>
      <p className="sub">
        Every org on Zaroda Books, its owner, and what it has been sold. Figures are counted
        live — nothing here is stored.
      </p>

      <div className="grid-4" style={{ marginBottom: "1.25rem" }}>
        <Figure
          label="Orgs"
          value={String(t.orgs)}
          note={pending === 0 ? `${t.users} users` : `${pending} awaiting review`}
        />
        <Figure label="Schools" value={String(t.schools)} note={`${t.books} books opened`} />
        <Figure
          label="Collected"
          value={`KSh ${formatKes(t.collected)}`}
          note={`${t.paidCount} subscriptions paid`}
        />
        <Figure
          label="Outstanding"
          value={`KSh ${formatKes(t.outstanding)}`}
          note={`${t.unpaidCount} awaiting payment · ${t.freeCount} free`}
        />
      </div>

      <div className="card" style={{ padding: "1.25rem 1.5rem" }}>
        <table>
          <thead>
            <tr>
              <th>Org</th>
              <th>Owner</th>
              <th className="n">Schools</th>
              <th className="n">Books</th>
              <th>Subscriptions</th>
              <th>Last posting</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((row) => (
              <tr key={row.orgId}>
                <td>
                  <Link href={`/admin/${row.orgId}`}>{row.orgName}</Link>
                  {!row.approvedAt && (
                    <div className="mono" style={{ fontSize: ".68rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--alarm)" }}>
                      Awaiting review
                    </div>
                  )}
                </td>
                <td>
                  {row.ownerName ?? "—"}
                  <div className="note">{row.ownerEmail ?? ""}{row.ownerPhone ? ` · ${row.ownerPhone}` : ""}</div>
                </td>
                <td className="n">{row.schools}</td>
                <td className="n">{row.books}</td>
                <td>
                  {row.subscriptions.length === 0 ? (
                    <span className="zero">none</span>
                  ) : (
                    row.subscriptions.map((s) => (
                      <div key={`${s.level}-${s.fyLabel}`} style={{ fontSize: ".84rem" }}>
                        {s.fyLabel} {s.level}{" "}
                        <span style={{ color: s.isFree ? "var(--muted)" : s.paidAt ? "var(--gold)" : "var(--alarm)" }}>
                          {s.isFree ? "free" : s.paidAt ? "paid" : "unpaid"}
                        </span>
                      </div>
                    ))
                  )}
                </td>
                <td>{day(row.lastPostedAt)}</td>
                <td>{day(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && <p className="note">No one has signed up yet.</p>}
      </div>
    </>
  );
}
