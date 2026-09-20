import {
  CHART_OF_ACCOUNTS, LEVEL_OPTIONS, accountTypesFor, financialYearInProgress,
  financialYearLabels, priceLabel,
} from "@/domain";
import type { SchoolLevel } from "@/domain";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformAdmin } from "@/server/auth";
import { orgEntitlements } from "@/server/books";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NewBookForm } from "./form";
import { ArchivedBooks } from "./archived";
import { BackLink } from "../back-link";

/**
 * Where the tenant stands before they fill anything in. A refusal arrived at
 * after typing the school's name and choosing the year is a bad way to find
 * out the rule.
 */
function Entitlement({
  freeUsed, covered, approved, isOwner,
}: Awaited<ReturnType<typeof orgEntitlements>> & { isOwner: boolean }) {
  if (isOwner) {
    return (
      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <div className="eyebrow" style={{ color: "var(--gold)" }}>Zaroda Solutions</div>
        <p style={{ margin: ".5rem 0 0", fontSize: ".9rem", lineHeight: 1.6, color: "var(--muted)" }}>
          Your own books open without a subscription. The subscription is money paid to
          Zaroda, so there is nobody to pay it to.
        </p>
      </div>
    );
  }

  if (!approved && covered.length === 0) {
    return (
      <div className="card" style={{ marginBottom: "1.35rem", borderLeft: "3px solid var(--gold)" }}>
        <div className="eyebrow" style={{ color: "var(--gold)" }}>We are reviewing your account</div>
        <p style={{ margin: ".5rem 0 0", fontSize: ".9rem", lineHeight: 1.6, color: "var(--muted)" }}>
          Your free school opens as soon as that is done, usually the same working day. Nothing is
          lost in the meantime. If it is urgent, reach us on{" "}
          <a href="https://wa.me/254781230805">WhatsApp 0781 230 805</a> or{" "}
          <a href="mailto:info@zarodasolutions.com">info@zarodasolutions.com</a>.
        </p>
      </div>
    );
  }

  if (!freeUsed && covered.length === 0) {
    return (
      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <div className="eyebrow" style={{ color: "var(--gold)" }}>Your first school is free</div>
        <p style={{ margin: ".5rem 0 0", fontSize: ".9rem", lineHeight: 1.6, color: "var(--muted)" }}>
          One school, at one level, for one financial year — with every account it keeps at that
          level: tuition, operations, infrastructure, boarding, lunch. Open them as you need them.
          A second school, a second level, or a later year is subscribed for.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: "1.35rem" }}>
      <div className="eyebrow" style={{ color: "var(--gold)" }}>What you may open</div>
      <table style={{ marginTop: ".6rem" }}>
        <thead><tr><th>Year</th><th>Level</th><th>How</th></tr></thead>
        <tbody>
          {covered.map((c) => (
            <tr key={`${c.level}-${c.fyLabel}`}>
              <td>{c.fyLabel}</td>
              <td style={{ textTransform: "capitalize" }}>{c.level}</td>
              <td>{c.isFree ? "Your free school" : c.paidAt ? "Subscribed" : "Subscribed, payment pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: ".85rem 0 0", fontSize: ".9rem", lineHeight: 1.6, color: "var(--muted)" }}>
        Any account at a level and year listed above opens straight away. Anything else needs a
        subscription — {LEVEL_LINE}{" "}
        <Link href="/app/subscribe">Pay by M-Pesa</Link> and the books open as soon as the
        payment goes through.
      </p>
    </div>
  );
}

const LEVEL_LINE = `KSh ${priceLabel("primary")} primary, KSh ${priceLabel("junior")} junior, `
  + `KSh ${priceLabel("senior")} senior, per year.`;

export default async function NewBookPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [entitlements, owner, [account]] = await Promise.all([
    orgEntitlements(user.orgId),
    isPlatformAdmin(user.id),
    db.select({ phone: schema.users.phone }).from(schema.users)
      .where(eq(schema.users.id, user.id)),
  ]);

  // Books are opened for years already gone as often as for the current one:
  // a freelance accountant taking on a school writes up its back years first.
  const years = financialYearLabels(financialYearInProgress(), 2022);

  // The chart differs by level, so the form needs all of them up front.
  const charts = Object.fromEntries(
    (Object.keys(CHART_OF_ACCOUNTS) as SchoolLevel[]).map((level) => [
      level,
      accountTypesFor(level).map((a) => ({
        id: a.id,
        label: a.label,
        source: a.source ?? null,
        heads: a.heads.map((h) => ({ code: h.code, name: h.name })),
      })),
    ]),
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: ".75rem" }}>
        <BackLink />
      </div>
      <h1>Create the book</h1>
      <p className="sub">
        The school, the level, the account and the financial year fix the chart of accounts and the
        twelve monthly periods. These cannot be renumbered afterwards.
      </p>
      <Entitlement {...entitlements} isOwner={owner} />
      <NewBookForm
        years={years}
        levels={LEVEL_OPTIONS}
        charts={charts}
        covered={entitlements.covered}
        isOwner={owner}
        defaultPhone={account?.phone ?? ""}
      />
      <ArchivedBooks orgId={user.orgId} />
    </div>
  );
}
