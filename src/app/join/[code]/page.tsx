import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/domain";
import { getCurrentUser } from "@/server/auth";
import { AuthLayout } from "../../auth-layout";
import { AcceptForm } from "./form";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const [row] = await db
    .select({ invite: schema.invitations, org: schema.orgs })
    .from(schema.invitations)
    .innerJoin(schema.orgs, eq(schema.orgs.id, schema.invitations.orgId))
    .where(eq(schema.invitations.code, code));

  const user = await getCurrentUser();

  // Every dead end says the same thing, so a stale link cannot be used to
  // work out whether an org exists or who was invited to it.
  const dead = !row
    || Boolean(row.invite.revokedAt)
    || Boolean(row.invite.acceptedAt)
    || row.invite.expiresAt < new Date();

  if (dead) {
    return (
      <AuthLayout
        title="That invitation is not usable"
        subtitle="It may have been used already, cancelled, or lapsed."
        aside="Ask whoever invited you to send another."
      >
        <p className="note">
          Invitations work once and last fourteen days.{" "}
          <Link href="/login">Log in</Link> if you already have an account.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={`Join ${row.org.name}`}
      subtitle={`You have been invited as ${ROLE_LABEL[row.invite.role].toLowerCase()}.`}
      aside="One login, every school you keep books for."
    >
      <p className="note" style={{ marginBottom: "1.25rem", lineHeight: 1.6 }}>
        {ROLE_DESCRIPTION[row.invite.role]}
      </p>

      {user ? (
        <AcceptForm code={code} orgName={row.org.name} email={user.email} />
      ) : (
        <>
          <p className="note" style={{ marginBottom: "1.25rem" }}>
            Sign in first, or create your account, then open this link again. The invitation
            keeps until you do.
          </p>
          <div style={{ display: "flex", gap: ".7rem", flexWrap: "wrap" }}>
            <Link href="/login" className="btn btn-gold" style={{ color: "#fff", textDecoration: "none" }}>
              Log in
            </Link>
            <Link href="/signup" className="btn btn-quiet" style={{ textDecoration: "none" }}>
              Create an account
            </Link>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
