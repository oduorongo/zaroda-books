import type { jsPDF } from "jspdf";
import type { SchoolLevel } from "@/domain";
import { LEVEL_MARK } from "./level-mark";

/**
 * The level band as the printed page draws it (globals.css .level-band), in
 * black only: a filled band for primary, a double box for junior, a heavy box
 * with an inner line for senior. Returns the height used.
 */
export function drawLevelBand(pdf: jsPDF, level: SchoolLevel, centre: number, top: number): number {
  const { label, letter } = LEVEL_MARK[level];
  pdf.setFont("helvetica", "bold").setFontSize(8);
  const w = pdf.getTextWidth(label) + 8;
  const h = 6;
  const x = centre - w / 2 + 5;
  const y = top;

  pdf.setDrawColor(0).setTextColor(0);
  if (level === "primary") {
    pdf.setFillColor(0, 0, 0).rect(x, y, w, h, "F");
    pdf.setTextColor(255);
  } else if (level === "junior") {
    pdf.setLineWidth(0.3).rect(x, y, w, h).rect(x + 0.8, y + 0.8, w - 1.6, h - 1.6);
  } else {
    pdf.setFillColor(228, 228, 228).setLineWidth(0.9).rect(x, y, w, h, "FD");
    pdf.setLineWidth(0.2).rect(x - 1.1, y - 1.1, w + 2.2, h + 2.2);
  }
  pdf.text(label, x + w / 2, y + h / 2 + 1.1, { align: "center" });

  // The letter in its shape, left of the band.
  const cx = x - 6;
  const cy = y + h / 2;
  pdf.setTextColor(0).setLineWidth(0.4);
  if (level === "primary") pdf.circle(cx, cy, 3.4);
  else if (level === "junior") pdf.rect(cx - 3.2, cy - 3.2, 6.4, 6.4);
  else pdf.lines([[3.8, 3.8], [-3.8, 3.8], [-3.8, -3.8], [3.8, -3.8]], cx, cy - 3.8, [1, 1], "S", true);
  pdf.setFont("times", "bold").setFontSize(10).text(letter, cx, cy + 1.3, { align: "center" });

  return h + 3;
}

/** The letterhead rule in the level's style. */
export function drawLevelRule(pdf: jsPDF, level: SchoolLevel, left: number, right: number, y: number) {
  pdf.setDrawColor(0);
  if (level === "primary") pdf.setLineWidth(0.35).line(left, y, right, y);
  else if (level === "junior") pdf.setLineWidth(0.3).line(left, y, right, y).line(left, y + 0.9, right, y + 0.9);
  else pdf.setLineWidth(0.9).line(left, y, right, y).setLineWidth(0.2).line(left, y + 1.4, right, y + 1.4);
}

/** The Zaroda footnote, at the foot of every page. */
export function drawPoweredBy(pdf: jsPDF) {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  for (let p = 1; p <= pdf.getNumberOfPages(); p += 1) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "italic").setFontSize(6.5).setTextColor(130);
    pdf.text("Powered by ZARODA SOLUTIONS · Reliable. Innovative. Forward.", width / 2, height - 3.5, { align: "center" });
  }
}
