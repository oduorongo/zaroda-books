import Link from "next/link";
import { COUNTIES } from "@/domain";
import { coverage } from "@/server/platform";

export default async function CoveragePage() {
  const { rows, schoolsPlaced, schoolsUnplaced, countiesReached } = await coverage();
  const reached = new Set(rows.filter((r) => r.schools > 0).map((r) => r.county));

  return (
    <>
      <Link href="/admin" className="back-link">← All tenants</Link>
      <h1>Coverage</h1>
      <p className="sub">
        Counted from the schools, not from the subscribers — a book keeper in Nairobi keeping
        thirty schools in Kisii is coverage of Kisii.
      </p>

      <div className="grid-3" style={{ marginBottom: "1.35rem" }}>
        <div className="card">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Counties reached</div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.9rem", fontWeight: 700, margin: ".5rem 0 .2rem" }}>
            {countiesReached} <span style={{ fontSize: "1rem", color: "var(--muted)" }}>of 47</span>
          </div>
          <div className="note">{47 - countiesReached} still to reach</div>
        </div>
        <div className="card">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Schools placed</div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.9rem", fontWeight: 700, margin: ".5rem 0 .2rem" }}>
            {schoolsPlaced}
          </div>
          <div className="note">on the map</div>
        </div>
        <div className="card">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Not yet placed</div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.9rem", fontWeight: 700, margin: ".5rem 0 .2rem", color: schoolsUnplaced ? "var(--alarm)" : undefined }}>
            {schoolsUnplaced}
          </div>
          <div className="note">no county set on the book</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
          Where the books are
        </div>
        <table>
          <thead>
            <tr>
              <th>County</th>
              <th className="n">Schools</th>
              <th className="n">Subscribers based here</th>
              <th>Sub-counties</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.county}>
                <td>{r.county}</td>
                <td className="n">{r.schools || <span className="zero">0</span>}</td>
                <td className="n">{r.orgs || <span className="zero">0</span>}</td>
                <td style={{ fontSize: ".84rem", color: "var(--muted)" }}>
                  {r.subCounties.length ? r.subCounties.join(", ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="note">
            No county has been set on any school or org yet. They fill in as tenants sign up and
            set the county on each book.
          </p>
        )}
      </div>

      <div className="card">
        <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
          Counties with no school yet
        </div>
        <p style={{ fontSize: ".88rem", lineHeight: 1.8, color: "var(--muted)", margin: 0 }}>
          {COUNTIES.filter((c) => !reached.has(c)).join(" · ") || "All 47 reached."}
        </p>
      </div>
    </>
  );
}
