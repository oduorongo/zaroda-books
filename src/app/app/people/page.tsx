import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROLE_DESCRIPTION, ROLE_LABEL, can } from "@/domain";
import { getCurrentUser } from "@/server/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { orgPeople } from "@/server/people";
import { SITE_URL } from "@/app/site-url";
import { BackLink } from "../back-link";
import { InviteForm, RemoveButton, RevokeInviteButton, RoleSelect } from "./forms";

const day = (d: Date) =>
  new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { members, invites } = await orgPeople(user.orgId);
  const schools = await db
    .select({ id: schema.schools.id, name: schema.schools.name })
    .from(schema.schools)
    .where(eq(schema.schools.orgId, user.orgId))
    .orderBy(schema.schools.name);
  const schoolName = (id: string | null) =>
    schools.find((s) => s.id === id)?.name ?? null;
  const owner = can(user.role, "people.manage") && !user.readOnly;

  // Whatever host they are actually on, so the link works from a preview
  // deployment as well as the live domain.
  const host = (await headers()).get("host");
  const origin = host ? `https://${host}` : SITE_URL;

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: ".75rem" }}><BackLink /></div>
      <h1>People</h1>
      <p className="sub">
        Who can reach these books, and what each of them may do. Everyone here reads every
        book; the role decides what they may change.
      </p>

      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
          On these books
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Books</th>
              {owner && <th>Change</th>}{owner && <th></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user.id}>
                <td>
                  {m.user.name}
                  {m.user.id === user.id && <span className="note"> (you)</span>}
                  <div className="note">{m.user.email}</div>
                </td>
                <td>
                  {ROLE_LABEL[m.membership.role]}
                  <div className="note">{ROLE_DESCRIPTION[m.membership.role]}</div>
                </td>
                <td>
                  {m.membership.schoolId
                    ? <>{schoolName(m.membership.schoolId) ?? "One school"} <span className="note">only</span></>
                    : <span className="note">Every school</span>}
                </td>
                {owner && (
                  <td><RoleSelect userId={m.user.id} role={m.membership.role} /></td>
                )}
                {owner && (
                  <td>
                    {m.user.id !== user.id && (
                      <RemoveButton userId={m.user.id} name={m.user.name} />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {owner && invites.length > 0 && (
        <div className="card" style={{ marginBottom: "1.35rem" }}>
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
            Invitations not yet taken up
          </div>
          <table>
            <thead><tr><th>Email</th><th>Role</th><th>Books</th><th>Lapses</th><th></th></tr></thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td>{ROLE_LABEL[i.role]}</td>
                  <td>{i.schoolId ? schoolName(i.schoolId) ?? "One school" : "Every school"}</td>
                  <td>{day(i.expiresAt)}</td>
                  <td><RevokeInviteButton invitationId={i.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {owner ? (
        <div className="card">
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
            Invite someone
          </div>
          <InviteForm origin={origin} schools={schools} />
        </div>
      ) : (
        <p className="note">
          Only the owner of these books can invite people or change what someone may do.
        </p>
      )}
    </div>
  );
}
