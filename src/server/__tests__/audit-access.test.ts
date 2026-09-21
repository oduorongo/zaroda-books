import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The cross-tenant guards.
 *
 * `requirePlatformAdmin` and `requireAuditor` are the only two ways anything
 * reads outside its own org. Both answer with a 404 rather than a refusal, so
 * an unauthorised prober learns nothing — and both re-read the grant on every
 * call rather than trusting a cookie, so withdrawing one ends sessions
 * already in progress. These tests hold both properties in place.
 */

const getCurrentUser = vi.fn();
const isPlatformAdmin = vi.fn();
const auditorScope = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});

vi.mock("@/server/auth", () => ({ getCurrentUser, isPlatformAdmin, auditorScope }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/db", () => ({ db: {}, schema: {} }));

const { requirePlatformAdmin } = await import("@/server/platform");
const { requireAuditor } = await import("@/server/audit");

const someone = (over: Record<string, unknown> = {}) => ({
  id: "u1",
  name: "Jane",
  email: "jane@example.com",
  orgId: "org1",
  role: "owner",
  viewingAs: null,
  readOnly: false,
  bookScope: { kind: "org" },
  auditing: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  isPlatformAdmin.mockResolvedValue(false);
  auditorScope.mockResolvedValue(null);
});

describe("requirePlatformAdmin", () => {
  it("lets Zaroda through", async () => {
    getCurrentUser.mockResolvedValue(someone());
    isPlatformAdmin.mockResolvedValue(true);
    await expect(requirePlatformAdmin()).resolves.toMatchObject({ id: "u1" });
  });

  it("hides the console from an ordinary tenant", async () => {
    getCurrentUser.mockResolvedValue(someone());
    await expect(requirePlatformAdmin()).rejects.toThrow("NOT_FOUND");
  });

  it("hides it from a signed-out visitor", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(requirePlatformAdmin()).rejects.toThrow("NOT_FOUND");
  });

  it("refuses an admin who is currently viewing as a tenant", async () => {
    // Mid view-as they are acting as the tenant. Reading the console in that
    // state is how a screenshot ends up showing another school's figures.
    getCurrentUser.mockResolvedValue(someone({ viewingAs: { orgId: "org2", orgName: "X" } }));
    isPlatformAdmin.mockResolvedValue(true);
    await expect(requirePlatformAdmin()).rejects.toThrow("NOT_FOUND");
  });

  it("reads the grant from the table on every call", async () => {
    getCurrentUser.mockResolvedValue(someone());
    isPlatformAdmin.mockResolvedValue(true);
    await requirePlatformAdmin();
    expect(isPlatformAdmin).toHaveBeenCalledWith("u1");
  });
});

describe("requireAuditor", () => {
  it("lets a granted auditor through, with their area", async () => {
    getCurrentUser.mockResolvedValue(someone());
    auditorScope.mockResolvedValue({ county: "Kisumu", subCounty: "Seme" });
    await expect(requireAuditor()).resolves.toMatchObject({
      scope: { county: "Kisumu", subCounty: "Seme" },
    });
  });

  it("hides it from someone with no grant", async () => {
    getCurrentUser.mockResolvedValue(someone());
    await expect(requireAuditor()).rejects.toThrow("NOT_FOUND");
  });

  it("hides it from a signed-out visitor", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(requireAuditor()).rejects.toThrow("NOT_FOUND");
  });

  it("checks the grant afresh, so withdrawing it ends a session in progress", async () => {
    getCurrentUser.mockResolvedValue(someone());
    auditorScope.mockResolvedValue({ county: "Kisumu", subCounty: null });
    await requireAuditor();

    auditorScope.mockResolvedValue(null);
    await expect(requireAuditor()).rejects.toThrow("NOT_FOUND");
  });
});
