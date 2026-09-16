"use client";

import { useParams, useRouter } from "next/navigation";

export function BookSwitcher({ books }: { books: { accountId: string; label: string }[] }) {
  const router = useRouter();
  const { accountId } = useParams<{ accountId?: string }>();

  if (!books.length) return <div style={{ fontSize: ".85rem" }}>No books yet.</div>;

  return (
    <select
      value={accountId ?? books[0].accountId}
      onChange={(e) => router.push(`/app/${e.target.value}/receipts`)}
      aria-label="School and book"
    >
      {books.map((b) => (
        <option key={b.accountId} value={b.accountId}>{b.label}</option>
      ))}
    </select>
  );
}
