"use client";

import { useState } from "react";
import type { Letter } from "@/domain";

/** A4, Times 12 pt, the school's address at the top right, as the Ministry receives them. */
export function LetterPdfButton({ href }: { href: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`${href}&format=json`);
      if (!res.ok) throw new Error(String(res.status));
      const { letter, filename }: { letter: Letter; filename: string } = await res.json();

      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const width = pdf.internal.pageSize.getWidth();
      const left = 25;
      const right = width - 20;
      const step = 5.6;
      let y = 22;

      pdf.setFont("times", "normal").setFontSize(12).setTextColor(0, 0, 0);
      const write = (text: string, opts: { right?: boolean; bold?: boolean } = {}) => {
        pdf.setFont("times", opts.bold ? "bold" : "normal");
        const wrapped: string[] = pdf.splitTextToSize(text, right - left);
        for (const l of wrapped) {
          pdf.text(l, opts.right ? right : left, y, { align: opts.right ? "right" : "left" });
          y += step;
        }
      };
      const gap = () => { y += step; };

      letter.sender.forEach((l) => write(l, { right: true }));
      gap();
      write(letter.date, { right: true });
      gap();
      write("TO");
      letter.addressee.forEach((l) => write(l));
      gap();
      write("THRO'");
      letter.through.forEach((l) => write(l));
      gap();
      write("Dear Sir / Madam,");
      gap();
      // Bold and underlined, as the subject line of a Ministry letter is.
      pdf.setFont("times", "bold");
      for (const l of pdf.splitTextToSize(letter.subject, right - left) as string[]) {
        pdf.text(l, left, y);
        pdf.setLineWidth(0.25).line(left, y + 0.9, left + pdf.getTextWidth(l), y + 0.9);
        y += step;
      }
      gap();
      write(letter.opening);
      y += 1;

      const head = ["ACCOUNT NAME", "ACCOUNT NO.", ...(letter.showBankColumn ? ["BANK"] : []), "AMOUNT (KSh)"];
      const last = head.length - 1;
      const body = [
        ...letter.rows.map((r) => [r.name, r.number, ...(letter.showBankColumn ? [r.bank] : []), r.amount]),
        ["TOTAL", "", ...(letter.showBankColumn ? [""] : []), letter.total],
      ];
      autoTable(pdf, {
        startY: y,
        margin: { left, right: width - right },
        head: [head],
        body,
        theme: "grid",
        styles: { font: "times", fontSize: 12, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, cellPadding: 1.8 },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold" },
        columnStyles: { [last]: { halign: "right" } },
        didParseCell: (d) => {
          if (d.section === "body" && d.row.index === body.length - 1) d.cell.styles.fontStyle = "bold";
          if (d.section === "head" && d.column.index === last) d.cell.styles.halign = "right";
        },
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + step + 1;

      write(letter.bankLine);
      gap();
      write("Thank you in advance.");
      gap();
      write("Yours faithfully,");
      // Room for the signature and the school stamp, which are never drawn.
      y += step * 4;
      letter.signature.forEach((l) => write(l));

      pdf.save(`${filename}.pdf`);
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
