import type { ReactNode } from "react";
import type { SchoolLevel } from "@/domain";
import { LevelBand, PoweredBy } from "./level-mark";
import { BackLink } from "../back-link";
import { PdfButton } from "./pdf-button";
import { PrintButton } from "./print-button";

/**
 * Every report prints the same way: an A4 letterhead the Ministry and the
 * auditor expect, and the screen chrome dropped. Wide books go landscape.
 */
export function ReportShell({
  title, sub, school, level, account, fyLabel, period, csvHref, landscape, children,
}: {
  title: string;
  sub: ReactNode;
  school: string;
  level: SchoolLevel;
  account: string;
  fyLabel: string;
  period?: string;
  csvHref?: string;
  landscape?: boolean;
  children: ReactNode;
}) {
  const printed = new Date().toLocaleDateString("en-KE", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className={`report level-${level}${landscape ? " print-landscape" : ""}`}>
      <header className={`letterhead level-${level}`}>
        <LevelBand level={level} />
        <div className="letterhead-school">{school}</div>
        <div className="letterhead-title">{title}</div>
        <div className="letterhead-meta">
          {account} account · FY {fyLabel}{period ? ` · ${period}` : ""}
        </div>
      </header>

      <div className="no-print" style={{ marginBottom: ".75rem" }}>
        <BackLink />
      </div>

      <div className="report-bar no-print">
        <div>
          <h1>{title}</h1>
          <p className="sub">{sub}</p>
        </div>
        <div className="report-actions">
          {csvHref && <PdfButton href={csvHref} landscape={landscape} />}
          {csvHref && <a className="btn btn-quiet" href={csvHref} download>Download CSV</a>}
          <PrintButton />
        </div>
      </div>

      {children}

      <footer className="letterhead-foot">
        Printed {printed} · ZARODA BOOKS
      </footer>
      <PoweredBy />
    </div>
  );
}
