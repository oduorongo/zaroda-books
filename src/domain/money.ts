/** All money is integer cents of KES. Never use floats for money. */
export type Cents = number;

export const toCents = (kes: number): Cents => Math.round(kes * 100);
export const toKes = (c: Cents): number => c / 100;

export const formatKes = (c: Cents): string =>
  (c / 100).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const sum = (ns: Cents[]): Cents => ns.reduce((a, b) => a + b, 0);
