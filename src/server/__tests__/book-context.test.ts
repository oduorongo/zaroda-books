import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/domain";

/**
 * The access boundary on every book page.
 *
 * Nothing above the domain layer had a test until now, and every bug found by
 * hand today lived here — a gate that let the wrong people through, or the
 * right people through to the wrong thing. These are the guards, exercised
 * without a database.
 */

const getCurrentUser = vi.fn();
const getBookForOrg = vi.fn();
const redirect = vi.fn(() => {
  throw new Error("REDIRECTED");
});

vi.mock("@/server/auth", () => ({ getCurrentUser }));
vi.mock("@/server/queries", () => ({
  getBookForOrg,
  getVoteHeads: vi.fn(async () => []),
  getFinancialYear: vi.fn(async () => ({ id: "fy1", label: "2025/26" })),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { loadBook, ForbiddenError, ReadOnlyError } = await import("@/server/book-context");

const signedIn = (over: Partial<{ role: Role; readOnly: boolean }> = {}) => ({
  id: "u1",
  name: "Jane",
  email: "jane@example.com",
  orgId: "org1",
  role: "owner" as Role,
  viewingAs: null,
  readOnly: false,
  bookScope: { kind: "org" as const },
  auditing: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  getBookForOrg.mockResolvedValue({
    account: { id: "a1", name: "Tuition", type: "TUITION" },
    school: { id: "s1", name: "Manyonge", level: "junior" },
  });
});

describe("loadBook, signed out", () => {
  it("sends them to the login rather than loading anything", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(loadBook("a1")).rejects.toThrow("REDIRECTED");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(getBookForOrg).not.toHaveBeenCalled();
  });
});

describe("loadBook, reading", () => {
  it("lets any role read, including a viewer", async () => {
    for (const role of ["owner", "accountant", "bursar", "viewer"] as Role[]) {
      getCurrentUser.mockResolvedValue(signedIn({ role }));
      await expect(loadBook("a1")).resolves.toMatchObject({ account: { id: "a1" } });
    }
  });

  it("lets a read-only session read", async () => {
    getCurrentUser.mockResolvedValue(signedIn({ readOnly: true }));
    await expect(loadBook("a1")).resolves.toMatchObject({ account: { id: "a1" } });
  });

  it("passes the session's scope to the query, so narrowing cannot be skipped", async () => {
    const user = signedIn();
    user.bookScope = { kind: "school", schoolId: "s1" } as never;
    getCurrentUser.mockResolvedValue(user);
    await loadBook("a1");
    expect(getBookForOrg).toHaveBeenCalledWith("a1", "org1", { kind: "school", schoolId: "s1" });
  });
});

describe("loadBook, writing", () => {
  it("refuses a read-only session", async () => {
    getCurrentUser.mockResolvedValue(signedIn({ readOnly: true }));
    await expect(loadBook("a1", { write: true })).rejects.toBeInstanceOf(ReadOnlyError);
  });

  it("checks read-only before the role, so a viewing owner is still stopped", async () => {
    getCurrentUser.mockResolvedValue(signedIn({ role: "owner", readOnly: true }));
    await expect(loadBook("a1", { write: true, require: "entry.post" }))
      .rejects.toBeInstanceOf(ReadOnlyError);
  });

  it("lets an ordinary session write when no particular right is required", async () => {
    getCurrentUser.mockResolvedValue(signedIn({ role: "bursar" }));
    await expect(loadBook("a1", { write: true })).resolves.toBeTruthy();
  });
});

describe("loadBook, rights", () => {
  it("lets a bursar post", async () => {
    getCurrentUser.mockResolvedValue(signedIn({ role: "bursar" }));
    await expect(loadBook("a1", { write: true, require: "entry.post" })).resolves.toBeTruthy();
  });

  it("stops a bursar deleting", async () => {
    getCurrentUser.mockResolvedValue(signedIn({ role: "bursar" }));
    await expect(loadBook("a1", { write: true, require: "entry.delete" }))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it("names the role and the act, so the message is actionable", async () => {
    getCurrentUser.mockResolvedValue(signedIn({ role: "bursar" }));
    await expect(loadBook("a1", { write: true, require: "entry.delete" }))
      .rejects.toThrow(/bursar cannot delete an entry/i);
  });

  it("stops a viewer posting", async () => {
    getCurrentUser.mockResolvedValue(signedIn({ role: "viewer" }));
    await expect(loadBook("a1", { write: true, require: "entry.post" }))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it("stops an accountant reopening a period but lets them close one", async () => {
    getCurrentUser.mockResolvedValue(signedIn({ role: "accountant" }));
    await expect(loadBook("a1", { write: true, require: "period.close" })).resolves.toBeTruthy();
    await expect(loadBook("a1", { write: true, require: "period.reopen" }))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets an owner do all of it", async () => {
    getCurrentUser.mockResolvedValue(signedIn({ role: "owner" }));
    for (const act of ["entry.delete", "period.reopen", "book.archive"] as const) {
      await expect(loadBook("a1", { write: true, require: act })).resolves.toBeTruthy();
    }
  });
});
