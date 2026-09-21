import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, listSessions } from "@/server/auth";
import { BackLink } from "../back-link";
import { SignOutDevice, SignOutOthers } from "./forms";

const stamp = (d: Date | null) =>
  d ? new Date(d).toLocaleString("en-KE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";

/**
 * A user agent is a long, unreadable string. This is not identification, only
 * enough for someone to recognise which of their own devices a row is.
 */
function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iOS/i.test(ua) ? "iPhone or iPad"
      : /Windows/i.test(ua) ? "Windows"
        : /Macintosh|Mac OS/i.test(ua) ? "Mac"
          : /Linux/i.test(ua) ? "Linux" : "Unknown";
  const browser = /Edg\//i.test(ua) ? "Edge"
    : /OPR\//i.test(ua) ? "Opera"
      : /Chrome\//i.test(ua) ? "Chrome"
        : /Safari\//i.test(ua) ? "Safari"
          : /Firefox\//i.test(ua) ? "Firefox" : "browser";
  return `${browser} on ${os}`;
}

export default async function DevicesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sessions = await listSessions(user.id);
  const others = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: ".75rem" }}><BackLink /></div>
      <h1>Signed-in devices</h1>
      <p className="sub">
        Every device signed in as {user.email}. Sign one out and it is shut out at once,
        not when it happens to lapse.
      </p>

      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <table>
          <thead>
            <tr><th>Device</th><th>Signed in</th><th>Last seen</th><th></th></tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  {describeDevice(s.userAgent)}
                  {s.isCurrent && <span className="note"> · this one</span>}
                  {s.ip && <div className="note mono">{s.ip}</div>}
                </td>
                <td>{stamp(s.createdAt)}</td>
                <td>{stamp(s.lastSeenAt)}</td>
                <td>{!s.isCurrent && <SignOutDevice sessionId={s.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note" style={{ marginTop: ".9rem" }}>
          Last seen is kept to about the hour, not the minute — recording it exactly would
          mean writing to the database on every page you open.
        </p>
      </div>

      {others > 0 && (
        <div className="card">
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".6rem" }}>
            Lost a phone?
          </div>
          <p className="note" style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>
            This signs out the other {others === 1 ? "device" : `${others} devices`} and leaves
            you signed in here. If the password may also be known, change it as well —{" "}
            <Link href="/forgot">set a new one</Link>.
          </p>
          <SignOutOthers />
        </div>
      )}
    </div>
  );
}
