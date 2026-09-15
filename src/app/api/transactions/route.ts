import { NextResponse } from "next/server";
import { validateTransaction, CHART_OF_ACCOUNTS } from "@/domain";
import type { Txn } from "@/domain";

/**
 * Validation runs here as well as in the server layer, so a bad payload never
 * reaches the database even if a future caller skips createTransaction().
 */
export async function POST(request: Request) {
  const body = (await request.json()) as Txn;
  const codes = CHART_OF_ACCOUNTS.SIMBA.map((h) => h.code); // TODO: load from the account
  const errors = validateTransaction(body, codes);

  if (errors.length) return NextResponse.json({ errors }, { status: 422 });
  return NextResponse.json({ ok: true, note: "Persistence not wired up yet." }, { status: 501 });
}
