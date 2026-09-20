"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, which is what makes the browser offer to
 * install the app. It renders nothing.
 *
 * Failures are swallowed on purpose: a browser with service workers blocked,
 * or a school network with a proxy in the way, should still get the books.
 * Being installable is a convenience, never a condition of use.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
