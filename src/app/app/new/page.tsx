import { CHART_OF_ACCOUNTS } from "@/domain";
import { NewBookForm } from "./form";

const ACCOUNT_LABELS: Record<string, string> = {
  SIMBA: "Capitation — Tuition (SIMBA)",
  GPA: "Capitation — Operations (GPA)",
  TUITION: "Tuition",
  OPERATIONS: "Operations",
  INFRASTRUCTURE: "Infrastructure",
  BOARDING: "Boarding",
  LUNCH: "Lunch",
};

export default function NewBookPage() {
  const thisYear = new Date().getFullYear();
  const years = [0, -1, -2].map((d) => {
    const y = thisYear + d;
    return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
  });

  const accountTypes = Object.keys(CHART_OF_ACCOUNTS).map((id) => ({
    id,
    label: ACCOUNT_LABELS[id] ?? id,
    heads: CHART_OF_ACCOUNTS[id as keyof typeof CHART_OF_ACCOUNTS],
  }));

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Create the book</h1>
      <p className="sub">
        The school, the level, the account and the financial year fix the chart of accounts and the
        twelve monthly periods. These cannot be renumbered afterwards.
      </p>
      <NewBookForm years={years} accountTypes={accountTypes} />
    </div>
  );
}
