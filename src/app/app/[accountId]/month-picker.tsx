import Link from "next/link";
import { monthKey } from "@/server/periods";

/** A month a report can be read at. Months with nothing posted are still
 *  reachable — an empty month is an answer too — but shown muted. */
export function MonthPicker({
  accountId, report, periods, active, posted,
}: {
  accountId: string;
  report: string;
  periods: { month: string; status: string }[];
  active: string;
  posted: Set<string>;
}) {
  return (
    <nav className="tabs" style={{ fontSize: ".82rem", flexWrap: "wrap" }}>
      {periods.map((p) => {
        const key = monthKey(p.month);
        return (
          <Link
            key={key}
            href={`/app/${accountId}/${report}?month=${key}`}
            aria-current={key === active ? "page" : undefined}
            style={posted.has(key) ? undefined : { color: "var(--muted)" }}
          >
            {new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-KE", {
              month: "short", year: "2-digit", timeZone: "UTC",
            })}
            {p.status === "closed" ? " ·" : ""}
          </Link>
        );
      })}
    </nav>
  );
}
