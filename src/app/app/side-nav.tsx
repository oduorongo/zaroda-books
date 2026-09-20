"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const BOOKS = ["cash-book", "ledger", "trial-balance", "cash-flow", "bank-reconciliation"];

export function SideNav() {
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
        { no: "06", label: "Vote heads", href: `/app/${accountId}/vote-heads` },
        { no: "07", label: "Book settings", href: `/app/${accountId}/settings` },
        { no: "08", label: "Subscription", href: "/app/subscribe" },
      ]
    : [
        { no: "01", label: "Create the book", href: "/app/new" },
        { no: "02", label: "Subscription", href: "/app/subscribe" },
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
        </Link>
      ))}
    </div>
  );
}
