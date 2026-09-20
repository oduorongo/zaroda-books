for (const host of ["https://zarodabooks.com", "https://www.zarodabooks.com"]) {
  try {
    const r = await fetch(host, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    console.log(`${host}  HTTP ${r.status}`);
    for (const h of ["server", "location", "x-vercel-id", "x-matched-path", "age", "cache-control", "x-vercel-cache"]) {
      const v = r.headers.get(h);
      if (v) console.log(`    ${h}: ${v}`);
    }
  } catch (e) {
    console.log(`${host}  FAILED — ${e.cause?.code || e.message}`);
  }
}
try {
  const r = await fetch("https://zarodabooks.com/robots.txt", { signal: AbortSignal.timeout(15000) });
  console.log("\n/robots.txt  HTTP", r.status);
  console.log((await r.text()).slice(0, 300));
} catch (e) { console.log("\n/robots.txt failed:", e.cause?.code || e.message); }
