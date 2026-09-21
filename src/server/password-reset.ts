import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { resetIsUsable } from "@/domain";
import { hashPassword, revokeSessions } from "@/server/auth";
import { emailLayout, sendEmail } from "@/server/email";

const VALID_MINUTES = 60;

/**
 * SHA-256 and not scrypt, deliberately. The token is 32 random bytes chosen by
 * us, not a human-chosen password, so there is nothing to brute force and no
 * reason to make verification slow.
 */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Starts a reset. Says nothing about whether the address has an account —
 * the caller gives the same answer either way, so this cannot be used to find
 * out who keeps books on Zaroda.
 */
export async function requestPasswordReset(email: string, origin: string, ip: string | null) {
  const address = email.trim().toLowerCase();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, address));
  if (!user) return;

  // Any earlier link stops working: asking again should not leave two keys
  // to the same door.
  await db.update(schema.passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(schema.passwordResets.userId, user.id));

  const token = randomBytes(32).toString("base64url");
  await db.insert(schema.passwordResets).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + VALID_MINUTES * 60 * 1000),
    requestedIp: ip,
  });

  const url = `${origin}/reset/${token}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your Zaroda Books password",
    html: emailLayout({
      heading: "Set a new password",
      body:
        `Somebody asked to reset the password for <strong>${user.email}</strong>. `
        + "Use the button below within the hour.",
      buttonLabel: "Set a new password",
      buttonUrl: url,
      footer:
        "If this was not you, nothing has changed and you can ignore this message. "
        + "The link works once and lapses after an hour.",
    }),
    text:
      `Somebody asked to reset the password for ${user.email}.\n\n`
      + `Open this within the hour to set a new one:\n${url}\n\n`
      + "If this was not you, nothing has changed. The link works once and lapses after an hour.",
  });
}

export async function resetForToken(token: string) {
  const [row] = await db.select().from(schema.passwordResets)
    .where(eq(schema.passwordResets.tokenHash, hashToken(token)));
  return resetIsUsable(row) ? row : undefined;
}

/**
 * Sets the new password, spends the link, and signs out every device.
 *
 * Signing the others out is the point of a reset as often as the new password
 * is: somebody resetting because their phone was taken needs whoever has it
 * shut out, not merely a second password in circulation.
 */
export async function completePasswordReset(token: string, password: string) {
  const row = await resetForToken(token);
  if (!row) throw new Error("That link is no longer usable. Ask for another.");

  await db.update(schema.users)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(schema.users.id, row.userId));

  await db.update(schema.passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(schema.passwordResets.id, row.id));

  await revokeSessions(row.userId);
}
