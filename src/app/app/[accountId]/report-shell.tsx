import type { ReactNode } from "react";
import { PrintButton } from "./print-button";

/**
 * Every report prints the same way: an A4 letterhead the Ministry and the
 * auditor expect, and the screen chrome dropped. Wide books go landscape.
 */
export function ReportShell({
  title, sub, school, account, fyLabel, period, csvHref, landscape, children,
}: {
  title: string;
  sub: ReactNode;
  school: string;
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
    <div className={landscape ? "report print-landscape" : "report"}>
      <header className="letterhead">
        <div className="letterhead-school">{school}</div>
        <div className="letterhead-title">{title}</div>
        <div className="letterhead-meta">
          {account} account · FY {fyLabel}{period ? ` · ${period}` : ""}
        </div>
      </header>

      <div className="report-bar no-print">
        <div>
          <h1>{title}</h1>
          <p className="sub">{sub}</p>
        </div>
        <div className="report-actions">
          {csvHref && <a className="btn btn-quiet" href={csvHref} download>Download CSV</a>}
          <PrintButton />
        </div>
      </div>

      {children}

      <footer className="letterhead-foot">
        Printed {printed} · ZARODA BOOKS
      </footer>
    </div>
  );
}
