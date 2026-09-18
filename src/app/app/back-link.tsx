"use client";

import { useRouter } from "next/navigation";

/**
 * Goes back the way the bursar came, rather than to a fixed parent: a receipt
 * is reached from the list, from the cash book and from an acknowledgement,
 * and "back" should mean the same thing in each case.
 */
export function BackLink() {
  const router = useRouter();

  return (
    <button type="button" className="btn-link back-link" onClick={() => router.back()}>
      ← Back
    </button>
  );
}
