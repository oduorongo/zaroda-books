"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAction } from "../actions";

/**
 * Polls while the customer is at the PIN prompt. Tuma's webhook is the normal
 * path and usually wins; this is the fallback for when it never arrives, which
 * the school system saw often enough to build the same thing.
 */
export function Waiting({ paymentId, initial }: { paymentId: string; initial: string }) {
  const [status, setStatus] = useState(initial);
  const [elapsed, setElapsed] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (status !== "pending") return;
    // Every four seconds for three minutes: an STK prompt times out well
    // before that, and polling for ever would hammer Tuma from an open tab.
    const tick = setInterval(async () => {
      setElapsed((e) => e + 4);
      const next = await checkAction(paymentId);
      if (next !== "pending") {
        setStatus(next);
        router.refresh();
      }
    }, 4000);
    return () => clearInterval(tick);
  }, [status, paymentId, router]);

  if (status === "success") {
    return (
      <div className="card" style={{ borderLeft: "3px solid var(--gold)" }}>
        <div className="eyebrow" style={{ color: "var(--gold)" }}>Payment received</div>
        <p style={{ margin: ".6rem 0 1.2rem", lineHeight: 1.6 }}>
          The subscription is open. You can create the book now — the first school it is used for
          is the one it stays with for the year.
        </p>
        <div style={{ display: "flex", gap: ".7rem", flexWrap: "wrap" }}>
          <Link href="/app/new" className="btn btn-gold" style={{ color: "#fff", textDecoration: "none" }}>
            Create the book
          </Link>
          <Link href={`/app/subscribe/${paymentId}/receipt`} className="btn btn-quiet" style={{ textDecoration: "none" }}>
            Receipt
          </Link>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="card" style={{ borderLeft: "3px solid var(--alarm)" }}>
        <div className="eyebrow" style={{ color: "var(--alarm)" }}>Payment not completed</div>
        <p style={{ margin: ".6rem 0 1.2rem", lineHeight: 1.6 }}>
          The prompt was cancelled or timed out, and nothing has been charged. You can send
          another request.
        </p>
        <Link href="/app/subscribe" className="btn btn-quiet" style={{ textDecoration: "none" }}>
          Try again
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="eyebrow" style={{ color: "var(--gold)" }}>Waiting for the M-Pesa PIN</div>
      <p style={{ margin: ".6rem 0 0", lineHeight: 1.6 }}>
        A prompt has gone to the phone. Enter the M-Pesa PIN on the handset to complete the
        payment. This page updates itself — leave it open.
      </p>
      {elapsed >= 90 && (
        <p className="note" style={{ marginTop: "1rem" }}>
          Still waiting after {Math.floor(elapsed / 60)} minute{elapsed >= 120 ? "s" : ""}. If no
          prompt arrived, the number may be wrong or the line unreachable. Nothing has been
          charged — you can{" "}
          <Link href="/app/subscribe">send another request</Link>.
        </p>
      )}
    </div>
  );
}
