"use client";

import { useActionState } from "react";
import { markAllSeenAction, markSeenAction } from "./actions";

export function MarkSeen({ problemId }: { problemId: string }) {
  const [, action, pending] = useActionState(markSeenAction, null);
  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="problemId" value={problemId} />
      <button type="submit" className="btn-link" style={{ fontSize: ".82rem" }} disabled={pending}>
        {pending ? "…" : "Seen"}
      </button>
    </form>
  );
}

export function MarkAllSeen() {
  return (
    <form action={markAllSeenAction}>
      <button type="submit" className="btn btn-quiet">Mark all as seen</button>
    </form>
  );
}
