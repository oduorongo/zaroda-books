import { CHART_OF_ACCOUNTS, accountTypesFor } from "@/domain";
import type { SchoolLevel } from "@/domain";
import { NewBookForm } from "./form";

const LEVELS: { id: SchoolLevel; label: string }[] = [
  { id: "primary", label: "Primary" },
  { id: "junior", label: "Junior School" },
  { id: "senior", label: "Secondary" },
];

export default function NewBookPage() {
  const thisYear = new Date().getFullYear();
  const years = [0, -1, -2].map((d) => {
    const y = thisYear + d;
    return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
  });

  // The chart differs by level, so the form needs all of them up front.
  const charts = Object.fromEntries(
    (Object.keys(CHART_OF_ACCOUNTS) as SchoolLevel[]).map((level) => [
      level,
      accountTypesFor(level).map((a) => ({
        id: a.id,
        label: a.label,
        source: a.source ?? null,
        heads: a.heads.map((h) => ({ code: h.code, name: h.name })),
      })),
    ]),
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Create the book</h1>
      <p className="sub">
        The school, the level, the account and the financial year fix the chart of accounts and the
        twelve monthly periods. These cannot be renumbered afterwards.
      </p>
      <NewBookForm years={years} levels={LEVELS} charts={charts} />
    </div>
  );
}
