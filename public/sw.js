// Chrome, Edge and Android will not offer to install a site unless a service
// worker is controlling the page, so one has to exist.
//
// It deliberately caches nothing. Every figure in this app is derived at read
// time from the database, and a cached page would show a bursar a trial
// balance that no longer matches the entries behind it. Stale books are worse
// than no books, so every request goes straight through to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
