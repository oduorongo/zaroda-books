import "server-only";
import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun,
  UnderlineType, WidthType,
} from "docx";
import type { Letter } from "@/domain";

const para = (text: string, opts: { right?: boolean; bold?: boolean; after?: number } = {}) =>
  new Paragraph({
    alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { after: opts.after ?? 0 },
    children: [new TextRun({ text, bold: opts.bold })],
  });

const block = (lines: string[], right = false) =>
  lines.map((l, i) => para(l, { right, after: i === lines.length - 1 ? 240 : 0 }));

const cell = (text: string, opts: { bold?: boolean; right?: boolean } = {}) =>
  new TableCell({
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text, bold: opts.bold })],
    })],
  });

/** The letter as a Word file, laid out as the PDF is, so a school can edit before signing. */
export async function letterDocx(letter: Letter): Promise<Uint8Array<ArrayBuffer>> {
  const head = ["ACCOUNT NAME", "ACCOUNT NO.", ...(letter.showBankColumn ? ["BANK"] : []), "AMOUNT (KSh)"];
  const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line,
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: head.map((h, i) => cell(h, { bold: true, right: i === head.length - 1 })),
      }),
      ...letter.rows.map((r) => new TableRow({
        children: [
          cell(r.name),
          cell(r.number),
          ...(letter.showBankColumn ? [cell(r.bank)] : []),
          cell(r.amount, { right: true }),
        ],
      })),
      new TableRow({
        children: [
          cell("TOTAL", { bold: true }),
          cell(""),
          ...(letter.showBankColumn ? [cell("")] : []),
          cell(letter.total, { bold: true, right: true }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, bottom: 1134, left: 1417, right: 1134 },
        },
      },
      children: [
        ...block(letter.sender, true),
        para(letter.date, { right: true, after: 240 }),
        para("TO"),
        ...block(letter.addressee),
        para("THRO'"),
        ...block(letter.through),
        para("Dear Sir / Madam,", { after: 240 }),
        new Paragraph({
          spacing: { after: 240 },
          children: [new TextRun({ text: letter.subject, bold: true, underline: { type: UnderlineType.SINGLE } })],
        }),
        para(letter.opening, { after: 240 }),
        table,
        para("", { after: 120 }),
        para(letter.bankLine, { after: 240 }),
        para("Thank you in advance.", { after: 240 }),
        para("Yours faithfully,"),
        // Room for the signature and the school stamp, which are never drawn.
        ...Array.from({ length: 4 }, () => para("")),
        ...letter.signature.map((l) => para(l)),
      ],
    }],
  });

  return Uint8Array.from(await Packer.toBuffer(doc));
}
