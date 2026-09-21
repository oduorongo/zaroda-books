import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { ROLES, ROLE_LABEL, can, type Role } from "@/domain";
import { emailLayout, sendEmail } from "@/server/email";
import { getCurrentUser } from "@/server/auth";

/**
 * Who is in an org, and how someone else gets in.
 *
 * Every function that changes anything checks `people.manage`, which only an
 * owner holds. Roles were unenforced until now, so this is the first place a
 * tenant can hand out rights — and the place to be strict.
 */

const INVITE_DAYS = 14;

export async function orgPeople(orgId: string) {
  const [members, invites] = await Promise.all([
    db
      .select({ user: schema.users, membership: schema.memberships })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(eq(schema.memberships.orgId, orgId)),
    db
      .select()
      .from(schema.invitations)
      .where(and(
        eq(schema.invitations.orgId, orgId),
        isNull(schema.invitations.acceptedAt),
        isNull(schema.invitations.revokedAt),
      ))
      .orderBy(desc(schema.invitations.createdAt)),
  ]);
  return { members, invites };
}

async function requireOwner() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  if (user.readOnly) throw new Error("This is a read-only session.");
  if (!can(user.role, "people.manage")) {
    throw new Error("Only the owner of these books can manage who has access.");
  }
  return user;
}

export async function inviteToOrg(
  email: string,
  role: Role,
  schoolId: string | null,
  origin: string,
) {
  const owner = await requireOwner();
  const address = email.trim().toLowerCase();
  if (!address.includes("@")) throw new Error("Enter a valid email address.");
  if (!ROLES.includes(role)) throw new Error("Choose a role.");

  const [already] = await db
    .select({ id: schema.memberships.id })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.orgId, owner.orgId), eq(schema.users.email, address)));
  if (already) throw new Error("That person is already on these books.");

  // A school-scoped invitation must name a school of this org, or it would
  // silently widen to the whole practice when taken up.
  if (schoolId) {
    const [school] = await db.select({ id: schema.schools.id }).from(schema.schools)
      .where(and(eq(schema.schools.id, schoolId), eq(schema.schools.orgId, owner.orgId)));
    if (!school) throw new Error("That school is not on these books.");
  }

  // Long and random because it is the whole credential: there is no email
  // service yet, so the owner passes it on themselves.
  const code = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(schema.invitations).values({
    orgId: owner.orgId, email: address, role, schoolId, code, invitedBy: owner.id, expiresAt,
  });

  await db.insert(schema.auditLog).values({
    orgId: owner.orgId, userId: owner.id,
    action: "people.invited", entity: "invitation", entityId: null,
    before: null, after: JSON.stringify({ email: address, role, schoolId }),
  });

  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, owner.orgId));
  const orgName = org?.name ?? "Zaroda Books";
  const url = `${origin}/join/${code}`;
  const asRole = ROLE_LABEL[role].toLowerCase();

  // The code comes back either way. If the email fails, or is not configured,
  // the owner can still pass the link on by hand — which is how this worked
  // before there was any email at all.
  const sent = await sendEmail({
    to: address,
    subject: `${owner.name} has invited you to ${orgName}`,
    html: emailLayout({
      heading: `Join ${orgName}`,
      body:
        `<strong>${owner.name}</strong> has invited you to keep the books at `
        + `<strong>${orgName}</strong> as ${asRole}.`,
      buttonLabel: "Take up the invitation",
      buttonUrl: url,
      footer:
        "Sign in or create your account first, then open this link. It works once and "
        + "lapses after fourteen days.",
    }),
    text:
      `${owner.name} has invited you to ${orgName} as ${asRole}.\n\n`
      + `Open this link to accept:\n${url}\n\n`
      + "It works once and lapses after fourteen days.",
  });

  return { code, emailed: sent.ok };
}

export async function revokeInvite(invitationId: string) {
  const owner = await requireOwner();
  await db.update(schema.invitations).set({ revokedAt: new Date() })
    .where(and(
      eq(schema.invitations.id, invitationId),
      eq(schema.invitations.orgId, owner.orgId),
    ));
}

/**
 * Changes what someone may do. The last owner cannot be demoted: an org with
 * no owner can never invite anyone, change a role, or open a book again, and
 * only Zaroda could rescue it.
 */
export async function changeRole(userId: string, role: Role) {
  const owner = await requireOwner();
  if (!ROLES.includes(role)) throw new Error("Choose a role.");

  const members = await db.select().from(schema.memberships)
    .where(eq(schema.memberships.orgId, owner.orgId));
  const target = members.find((m) => m.userId === userId);
  if (!target) throw new Error("That person is not on these books.");

  const owners = members.filter((m) => m.role === "owner");
  if (target.role === "owner" && role !== "owner" && owners.length === 1) {
    throw new Error("These books would be left with no owner. Make someone else an owner first.");
  }

  await db.update(schema.memberships).set({ role })
    .where(eq(schema.memberships.id, target.id));

  await db.insert(schema.auditLog).values({
    orgId: owner.orgId, userId: owner.id,
    action: "people.role", entity: "membership", entityId: target.id,
    before: JSON.stringify({ role: target.role }), after: JSON.stringify({ role }),
  });
}

export async function removeFromOrg(userId: string) {
  const owner = await requireOwner();
  if (userId === owner.id) throw new Error("You cannot remove yourself.");

  const members = await db.select().from(schema.memberships)
    .where(eq(schema.memberships.orgId, owner.orgId));
  const target = members.find((m) => m.userId === userId);
  if (!target) return;
  if (target.role === "owner" && members.filter((m) => m.role === "owner").length === 1) {
    throw new Error("These books would be left with no owner.");
  }

  await db.delete(schema.memberships).where(eq(schema.memberships.id, target.id));

  await db.insert(schema.auditLog).values({
    orgId: owner.orgId, userId: owner.id,
    action: "people.removed", entity: "membership", entityId: target.id,
    before: JSON.stringify({ userId, role: target.role }), after: null,
  });
}

/**
 * Takes up an invitation. The person must already be signed in, so the code
 * never doubles as a way to create an account — a credential that both makes
 * a login and grants access to a school's books is one thing too many.
 */
export async function acceptInvite(code: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in or create your account first, then open the link again.");

  const [invite] = await db.select().from(schema.invitations)
    .where(eq(schema.invitations.code, code));
  if (!invite || invite.revokedAt) throw new Error("That invitation is no longer valid.");
  if (invite.acceptedAt) throw new Error("That invitation has already been used.");
  if (invite.expiresAt < new Date()) throw new Error("That invitation has expired. Ask for another.");

  const mine = await db.select().from(schema.memberships)
    .where(eq(schema.memberships.userId, user.id));
  if (mine.some((m) => m.orgId === invite.orgId)) {
    throw new Error("You are already on these books.");
  }

  await db.insert(schema.memberships).values({
    orgId: invite.orgId, userId: user.id, role: invite.role, schoolId: invite.schoolId,
  });
  await db.update(schema.invitations)
    .set({ acceptedAt: new Date(), acceptedBy: user.id })
    .where(eq(schema.invitations.id, invite.id));

  await db.insert(schema.auditLog).values({
    orgId: invite.orgId, userId: user.id,
    action: "people.joined", entity: "membership", entityId: null,
    before: null, after: JSON.stringify({ email: user.email, role: invite.role }),
  });
}
