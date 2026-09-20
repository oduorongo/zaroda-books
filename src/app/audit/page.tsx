import { describeAuditScope } from "@/domain";
import { auditTrail, requireAuditor, schoolsInScope } from "@/server/audit";
import { Logo } from "../logo";
import { logout } from "../login/actions";
import { openSchoolAction } from "./actions";

const stamp = (d: Date) =>
  new Date(d).toLocaleString("en-KE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

export default async function AuditPage() {
  const { user, scope } = await requireAuditor();
  const [schools, trail] = await Promise.all([
    schoolsInScope(scope),
    auditTrail(user.id),
  ]);

  return (
    <div>
      <div className="dark-band">
        <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".9rem" }}>
            <Logo height={34} priority />
            <div className="mono" style={{ letterSpacing: ".14em", fontSize: ".78rem", textTransform: "uppercase", borderLeft: "1px solid rgba(251,250,247,.3)", paddingLeft: ".9rem", color: "var(--gold-bright)" }}>
              Auditor
            </div>
          </div>
          <div className="admin-nav">
            <span style={{ color: "var(--on-dark-dim)" }}>{user.email}</span>
            <form action={logout}>
              <button type="submit" className="btn-link" style={{ color: "var(--on-dark)", fontSize: ".88rem" }}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ padding: "2.5rem 2.5rem 5rem" }}>
        <h1>{describeAuditScope(scope)}</h1>
        <p className="sub">
          Every school in your area keeping books on Zaroda, whoever keeps them. You may read and
          print; nothing here can be changed. Each school you open is recorded.
        </p>

        <div className="card" style={{ marginBottom: "1.35rem" }}>
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
            {schools.length} school{schools.length === 1 ? "" : "s"}
          </div>
          <table>
            <thead>
              <tr>
                <th>School</th><th>Level</th><th>Sub-county</th>
                <th>Books kept by</th><th>Open</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.schoolId}>
                  <td>{s.schoolName}</td>
                  <td style={{ textTransform: "capitalize" }}>{s.level}</td>
                  <td>{s.subCounty ?? "—"}</td>
                  <td>{s.orgName}</td>
                  <td>
                    {s.books.length === 0 ? (
                      <span className="zero">no open books</span>
                    ) : (
                      s.books.map((b) => (
                        <form key={b.accountId} action={openSchoolAction} style={{ display: "inline" }}>
                          <input type="hidden" name="schoolId" value={s.schoolId} />
                          <input type="hidden" name="accountId" value={b.accountId} />
                          <button type="submit" className="btn-link" style={{ fontSize: ".82rem", marginRight: ".8rem" }}>
                            {b.name}
                          </button>
                        </form>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {schools.length === 0 && (
            <p className="note">
              No school in your area keeps books on Zaroda yet. A school appears here once its
              book keeper sets its county and sub-county.
            </p>
          )}
        </div>

        <div className="card">
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
            Your recent access
          </div>
          <table>
            <thead><tr><th>When</th><th>School</th><th>Books kept by</th></tr></thead>
            <tbody>
              {trail.map((t) => (
                <tr key={t.row.id}>
                  <td>{stamp(t.row.at)}</td>
                  <td>{JSON.parse(t.row.after ?? "{}").school ?? "—"}</td>
                  <td>{t.orgName}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {trail.length === 0 && <p className="note">You have not opened a school yet.</p>}
        </div>
      </div>
    </div>
  );
}
