/**
 * `server-only` throws on import outside a React Server Component, which is
 * every unit test. Aliased to this in vitest.config.ts so the modules that
 * import it — the whole of src/server/ — can be tested at all.
 *
 * It is a build-time guard, not a runtime one: stubbing it in tests removes
 * nothing that protects the running app.
 */
export {};
