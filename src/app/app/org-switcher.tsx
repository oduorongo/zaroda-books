"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchOrgAction } from "./org-actions";

/**
 * Only rendered when somebody belongs to more than one set of books — a
 * freelancer with their own practice who has also been invited to a school.
 * For everyone else it would be a control with one option.
 */
export function OrgSwitcher({ orgs, current }: {
  orgs: { orgId: string; name: string }[];
  current: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div>
      <div className="eyebrow" style={{ color: "var(--on-dark-dim)", marginBottom: ".5rem" }}>
        Books
      </div>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => {
          const orgId = e.target.value;
          start(async () => {
            await switchOrgAction(orgId);
            router.refresh();
          });
        }}
      >
        {orgs.map((o) => <option key={o.orgId} value={o.orgId}>{o.name}</option>)}
      </select>
    </div>
  );
}
