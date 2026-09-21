import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Recording failures somebody has to act on.
 *
 * Six places in this codebase used to call console.error, which on Vercel
 * writes to a log nobody opens. The worst of them — a tenant paid and their
 * book could not be opened — would have stayed invisible until they rang up.
 *
 * Only things needing a human. A general application log that nobody reads is
 * the problem this replaces, not the shape to copy.
 */

export type ProblemArea = "payment" | "email" | "gateway" | "book";

/**
 * Never throws, and never awaited by the caller's happy path. A failure to
 * record a failure must not become a second, larger failure — least of all
 * inside a payment callback.
 */
export async function recordProblem(input: {
  area: ProblemArea;
  message: string;
  detail?: unknown;
  orgId?: string | null;
}): Promise<void> {
  // Still to the console: on Vercel that is where it can be found in the
  // minutes before anybody opens the console page.
  console.error(`[${input.area}] ${input.message}`, input.detail ?? "");

  try {
    await db.insert(schema.problems).values({
      area: input.area,
      message: input.message.slice(0, 500),
      detail: input.detail === undefined ? null : stringify(input.detail),
      orgId: input.orgId ?? null,
    });
  } catch (err) {
    console.error("Could not record a problem:", err);
  }
}

function stringify(detail: unknown): string {
  if (typeof detail === "string") return detail.slice(0, 4000);
  if (detail instanceof Error) return `${detail.name}: ${detail.message}`.slice(0, 4000);
  try {
    return JSON.stringify(detail).slice(0, 4000);
  } catch {
    return String(detail).slice(0, 4000);
  }
}

export async function unseenProblems(limit = 50) {
  return db
    .select({ problem: schema.problems, orgName: schema.orgs.name })
    .from(schema.problems)
    .leftJoin(schema.orgs, eq(schema.orgs.id, schema.problems.orgId))
    .where(isNull(schema.problems.seenAt))
    .orderBy(desc(schema.problems.at))
    .limit(limit);
}

export async function countUnseen(): Promise<number> {
  const rows = await db
    .select({ id: schema.problems.id })
    .from(schema.problems)
    .where(isNull(schema.problems.seenAt));
  return rows.length;
}

export async function markProblemSeen(problemId: string, userId: string) {
  await db.update(schema.problems)
    .set({ seenAt: new Date(), seenBy: userId })
    .where(and(eq(schema.problems.id, problemId), isNull(schema.problems.seenAt)));
}

export async function markAllSeen(userId: string) {
  await db.update(schema.problems)
    .set({ seenAt: new Date(), seenBy: userId })
    .where(isNull(schema.problems.seenAt));
}
