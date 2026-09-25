"use client";

import { useState } from "react";
import type { SchoolLevel } from "@/domain";
import { drawLevelBand, drawLevelRule, drawPoweredBy } from "./pdf-marks";

type Cell = string | number;
interface Section {
  heading?: string;
  columns?: string[];
  rows: Cell[][];
  total?: Cell[];
  note?: string;
}
interface ReportDoc {
  title: string;
  school: string;
  level?: SchoolLevel;
  account: string;
  fyLabel: string;
  period: string;
  landscape: boolean;
  filename: string;
  sections: Section[];
}

const INK = [16, 34, 63] as const;
const MUTED = [93, 102, 115] as const;

/** A figure column, so money lines up on the decimal point as in the books. */
const isFigure = (v: Cell) => typeof v === "number" || /^-?[\d,]+\.\d{2}$|^\d+%$/.test(String(v));

export function PdfButton({ href, landscape }: { href: string; landscape?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`${href}${href.includes("?") ? "&" : "?"}format=json`);
      if (!res.ok) throw new Error(String(res.status));
      const doc: ReportDoc = await res.json();

      // Loaded only when the button is pressed, so the library never sits in
      // the first load of a page that is mostly read, not printed.
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const pdf = new jsPDF({
        orientation: (landscape ?? doc.landscape) ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });
      const width = pdf.internal.pageSize.getWidth();
      const margin = 12;

      const top = doc.level ? 10 + drawLevelBand(pdf, doc.level, width / 2, 8) : 10;
      pdf.setFont("helvetica", "bold").setFontSize(14).setTextColor(...INK);
      pdf.text(doc.school, width / 2, top + 6, { align: "center" });
      pdf.setFont("helvetica", "normal").setFontSize(11);
      pdf.text(doc.title, width / 2, top + 12, { align: "center" });
      pdf.setFontSize(8.5).setTextColor(...MUTED);
      pdf.text(`${doc.account} account · FY ${doc.fyLabel} · ${doc.period}`, width / 2, top + 17, { align: "center" });
      if (doc.level) drawLevelRule(pdf, doc.level, margin, width - margin, top + 20);
      else pdf.setDrawColor(...INK).setLineWidth(0.4).line(margin, top + 20, width - margin, top + 20);

      let y = top + 28;
      for (const section of doc.sections) {
        if (section.heading) {
          pdf.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...INK);
          pdf.text(section.heading, margin, y);
          y += 4;
        }

        const body = section.total ? [...section.rows, section.total] : section.rows;
        const sample = section.rows[0] ?? section.columns ?? [];
        const columnStyles: Record<number, { halign: "right" }> = {};
        sample.forEach((_, i) => {
          if (section.rows.some((r) => isFigure(r[i]))) columnStyles[i] = { halign: "right" };
        });

        autoTable(pdf, {
          startY: y,
          margin: { left: margin, right: margin },
          head: section.columns ? [section.columns] : undefined,
          body: body.map((r) => r.map((c) => String(c ?? ""))),
          styles: { fontSize: 7.5, cellPadding: 1.4, textColor: [0, 0, 0], lineColor: [224, 220, 208], lineWidth: 0.1 },
          headStyles: { fillColor: [245, 242, 232], textColor: [...INK], fontStyle: "bold", halign: "left" },
          columnStyles,
          // The closing rule under the totals, as the workbooks draw it.
          didParseCell: (d) => {
            if (section.total && d.section === "body" && d.row.index === body.length - 1) {
              d.cell.styles.fontStyle = "bold";
              d.cell.styles.lineWidth = { top: 0.4, bottom: 0.4, left: 0, right: 0 };
            }
          },
        });

        y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

        if (section.note) {
          pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
          const lines = pdf.splitTextToSize(section.note, width - margin * 2);
          pdf.text(lines, margin, y);
          y += lines.length * 3.6 + 5;
        }
      }

      const printed = new Date().toLocaleDateString("en-KE", {
        day: "numeric", month: "long", year: "numeric",
      });
      const pages = pdf.getNumberOfPages();
      for (let p = 1; p <= pages; p += 1) {
        pdf.setPage(p);
        pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
        pdf.text(
          `Printed ${printed} · ZARODA BOOKS · page ${p} of ${pages}`,
          width - margin,
          pdf.internal.pageSize.getHeight() - 7,
          { align: "right" },
        );
      }
      drawPoweredBy(pdf);

      pdf.save(`${doc.filename}.pdf`);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn btn-quiet" onClick={download} disabled={busy}>
      {busy ? "Preparing…" : failed ? "Failed — try again" : "Download PDF"}
    </button>
  );
}
