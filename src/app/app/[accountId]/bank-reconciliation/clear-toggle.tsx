"use client";

import { useRef } from "react";
import { toggleCleared } from "./actions";

/**
 * Ticked means the bank has shown it. Unticked leaves it outstanding, which is
 * what puts it on the reconciliation statement above.
 */
export function ClearToggle({
  accountId, transactionId, cleared, defaultDate,
}: {
  accountId: string;
  transactionId: string;
  cleared: boolean;
  defaultDate: string;
}) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form action={toggleCleared} ref={form} style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="clearedOn" value={cleared ? "" : defaultDate} />
      <button type="submit" className="btn-link" style={{ textDecoration: "none" }}>
        {cleared ? "☑ shown" : "☐ outstanding"}
      </button>
    </form>
  );
}
