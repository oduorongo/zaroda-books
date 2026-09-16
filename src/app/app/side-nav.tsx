"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const BOOKS = ["cash-book", "ledger", "trial-balance", "cash-flow"];

export function SideNav() {
  const pathname = usePathname();
  const { accountId } = useParams<{ accountId?: string }>();

  const items = accountId
    ? [
        { no: "01", label: "Create the book", href: "/app/new" },
        { no: "02", label: "Receipts", href: `/app/${accountId}/receipts` },
        { no: "03", label: "Payments", href: `/app/${accountId}/payments` },
        { no: "04", label: "Final books", href: `/app/${accountId}/cash-book` },
        { no: "05", label: "Vote heads", href: `/app/${accountId}/vote-heads` },
      ]
    : [{ no: "01", label: "Create the book", href: "/app/new" }];

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
