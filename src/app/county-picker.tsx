"use client";

import { useState } from "react";
import { COUNTIES, subCountiesOf } from "@/domain";

/**
 * The two dropdowns together, because the second depends on the first: picking
 * a county has to reset the sub-county, or a form can post Mombasa / Seme.
 * The server checks the pair again regardless.
 */
export function CountyPicker({
  county: initialCounty = "", subCounty: initialSubCounty = "", required,
}: {
  county?: string | null;
  subCounty?: string | null;
  required?: boolean;
}) {
  const [county, setCounty] = useState(initialCounty ?? "");
  const [subCounty, setSubCounty] = useState(initialSubCounty ?? "");
  const subs = subCountiesOf(county);

  return (
    <div className="grid-2">
      <label className="field">County
        <select
          name="county"
          value={county}
          required={required}
          onChange={(e) => { setCounty(e.target.value); setSubCounty(""); }}
        >
          <option value="">Choose a county</option>
          {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="field">Sub-county
        <select
          name="subCounty"
          value={subCounty}
          required={required && subs.length > 0}
          disabled={subs.length === 0}
          onChange={(e) => setSubCounty(e.target.value)}
        >
          <option value="">{county ? "Choose a sub-county" : "Choose a county first"}</option>
          {subs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
    </div>
  );
}
