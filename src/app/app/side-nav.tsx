"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const BOOKS = ["cash-book", "ledger", "trial-balance", "cash-flow", "bank-reconciliation"];

/** Audit queries waiting on whoever is looking, per book. */
export function SideNav({ queries = {} }: { queries?: Record<string, number> }) {
  const pathname = usePathname();
  const { accountId } = useParams<{ accountId?: string }>();

  const items = accountId
    ? [
        { no: "01", label: "Create the book", href: "/app/new" },
        { no: "02", label: "Receipts", href: `/app/${accountId}/receipts` },
        // Money is received, then banked, then spent. The nav follows the work.
        { no: "03", label: "Cash and bank", href: `/app/${accountId}/cash-and-bank` },
        { no: "04", label: "Payments", href: `/app/${accountId}/payments` },
        { no: "05", label: "Final books", href: `/app/${accountId}/cash-book` },
        { no: "06", label: "Audit queries", href: `/app/${accountId}/queries`, count: queries[accountId] },
        { no: "07", label: "Vote heads", href: `/app/${accountId}/vote-heads` },
        { no: "08", label: "Book settings", href: `/app/${accountId}/settings` },
        { no: "09", label: "People", href: "/app/people" },
        { no: "10", label: "Subscription", href: "/app/subscribe" },
      ]
    : [
        { no: "01", label: "Create the book", href: "/app/new" },
        { no: "02", label: "People", href: "/app/people" },
        { no: "03", label: "Subscription", href: "/app/subscribe" },
      ];

  const current = (href: string) => {
    if (href.endsWith("/cash-book")) return BOOKS.some((b) => pathname.endsWith(`/${b}`));
    return pathname === href;
  };

  return (
    <div className="side-nav">
      {items.map((n) => (
        <Link key={n.href} href={n.href} aria-current={current(n.href) ? "page" : undefined}>
          <span className="no">{n.no}</span>
          <span>{n.label}</span>
          {"count" in n && n.count ? (
            <span className="mono" style={{ marginLeft: "auto", background: "var(--gold-bright)", color: "var(--ink-deep)", borderRadius: 10, padding: "0 .45rem", fontSize: ".72rem", fontWeight: 700 }}>
              {n.count}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
