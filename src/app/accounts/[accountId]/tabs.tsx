import Link from "next/link";

export function Tabs({ accountId, active }: { accountId: string; active: string }) {
  const items = [
    ["cash-book", "Cash book"],
    ["ledger", "Ledger"],
    ["trial-balance", "Trial balance"],
  ];
  return (
    <nav className="tabs">
      {items.map(([slug, label]) => (
        <Link
          key={slug}
          href={`/accounts/${accountId}/${slug}`}
          aria-current={slug === active ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
