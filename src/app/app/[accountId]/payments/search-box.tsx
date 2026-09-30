"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Narrows the payments list as the bursar types, a moment after they pause. */
export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const path = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = (q: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const t = q.trim();
      router.replace(t ? `${path}?q=${encodeURIComponent(t)}` : path, { scroll: false });
    }, 300);
  };

  return (
    <input name="q" type="search" defaultValue={initial} onChange={(e) => search(e.target.value)}
      style={{ flex: "1 1 16rem", maxWidth: "28rem" }}
      placeholder="Payee, VR no., cheque, vote head, amount or date" aria-label="Search payments" />
  );
}
