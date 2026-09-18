import Link from "next/link";

const TABS = [
  ["cash-book", "Cash book"],
  ["ledger", "Ledger"],
  ["trial-balance", "Trial balance"],
  ["cash-flow", "Cash flow"],
  ["bank-reconciliation", "Bank reconciliation"],
];

export function BookTabs({ accountId, active }: { accountId: string; active: string }) {
  return (
    <nav className="tabs">
      {TABS.map(([slug, label]) => (
        <Link
          key={slug}
          href={`/app/${accountId}/${slug}`}
          aria-current={slug === active ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
