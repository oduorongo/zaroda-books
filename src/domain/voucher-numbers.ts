/**
 * Payment voucher numbers run 1..N across a financial year, in date order,
 * starting again at 1 each 1 July.
 *
 * They are derived from the payments, not typed and not stored as a counter —
 * so inserting a payment into an earlier month slots it into the sequence and
 * pushes the rest along. That is what the bursar asked for, and it is worth
 * being clear about the cost: a voucher already printed as 42 can become 43,
 * and the paper in the file will no longer agree. Every move is written to
 * audit_log so the change can at least be traced.
 */

export interface VoucherRow {
  id: string;
  /** ISO yyyy-mm-dd. The primary order. */
  date: string;
  /** Tie-break for two payments on one day: which was entered first. */
  enteredAt: string;
  /** What the voucher currently carries, if anything. */
  vrNo?: string;
}

/** The whole year's sequence, in order, as it should stand. */
export function sequenceVouchers(payments: VoucherRow[]): { id: string; vrNo: string }[] {
  return [...payments]
    .sort((a, b) => (
      a.date < b.date ? -1
        : a.date > b.date ? 1
          : a.enteredAt < b.enteredAt ? -1
            : a.enteredAt > b.enteredAt ? 1
              : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    ))
    .map((p, i) => ({ id: p.id, vrNo: String(i + 1) }));
}

/**
 * Only the vouchers whose number actually moves. Writing a number back over
 * itself would cost a database write and, worse, leave an audit entry saying
 * something changed when nothing did.
 */
export function renumbering(
  payments: VoucherRow[],
): { id: string; from: string | null; to: string }[] {
  const was = new Map(payments.map((p) => [p.id, p.vrNo ?? null]));
  return sequenceVouchers(payments)
    .filter((s) => was.get(s.id) !== s.vrNo)
    .map((s) => ({ id: s.id, from: was.get(s.id) ?? null, to: s.vrNo }));
}
