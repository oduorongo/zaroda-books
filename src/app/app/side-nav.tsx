"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const BOOKS = ["cash-book", "ledger", "trial-balance", "cash-flow", "bank-reconciliation"];

/**
 * Audit queries waiting on whoever is looking, per book; and the books whose
 * capitation letter this person prepares.
 */
export function SideNav({ queries = {}, letterBooks = [] }: { queries?: Record<string, number>; letterBooks?: string[] }) {
  const pathname = usePathname();
  const { accountId } = useParams<{ accountId?: string }>();

  const entries: { label: string; href: string; count?: number }[] = accountId
    ? [
        { label: "Create the book", href: "/app/new" },
        { label: "Receipts", href: `/app/${accountId}/receipts` },
        ...(letterBooks.includes(accountId)
          ? [{ label: "Capitation letter", href: `/app/${accountId}/capitation-letter` }] : []),
        // Money is received, then banked, then spent. The nav follows the work.
        { label: "Cash and bank", href: `/app/${accountId}/cash-and-bank` },
        { label: "Payments", href: `/app/${accountId}/payments` },
        { label: "FINAL BOOKS", href: `/app/${accountId}/cash-book` },
        { label: "Book progress", href: `/app/${accountId}/progress` },
        { label: "Audit queries", href: `/app/${accountId}/queries`, count: queries[accountId] },
        { label: "Vote heads", href: `/app/${accountId}/vote-heads` },
        { label: "Book settings", href: `/app/${accountId}/settings` },
        { label: "People", href: "/app/people" },
        { label: "Subscription", href: "/app/subscribe" },
      ]
    : [
        { label: "Create the book", href: "/app/new" },
        { label: "People", href: "/app/people" },
        { label: "Subscription", href: "/app/subscribe" },
      ];
  const items = entries.map((e, i) => ({ ...e, no: String(i + 1).padStart(2, "0") }));

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
