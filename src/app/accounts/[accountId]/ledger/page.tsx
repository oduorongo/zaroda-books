import { buildLedger, formatKes } from "@/domain";
import { demoHeads, inMonth, upTo } from "@/demo/ongora-simba";
import { Tabs } from "../tabs";

const MONTH = "2026-05";

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;

  const priorMonths = upTo("2026-04");
  const opening = Object.fromEntries(
    buildLedger(priorMonths, demoHeads).map((l) => [l.code, { dr: l.dr, cr: l.cr }]),
  );
  const lines = buildLedger(inMonth(MONTH), demoHeads, opening);

  return (
    <main>
      <h1>Ledger accounts</h1>
      <p className="sub">May 2026 &mdash; SIMBA account</p>
      <Tabs accountId={accountId} active="ledger" />
      <table>
        <thead>
          <tr>
            <th>Vote head</th>
            <th className="n">Vote Dr</th><th className="n">Vote Cr</th>
            <th className="n">Brought forward Dr</th><th className="n">Brought forward Cr</th>
            <th className="n">Sub total Dr</th><th className="n">Sub total Cr</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.code}>
              <td>{l.name}</td>
              <td className="n">{formatKes(l.voteDr)}</td>
              <td className="n">{formatKes(l.voteCr)}</td>
              <td className="n carry">{formatKes(l.prevDr)}</td>
              <td className="n carry">{formatKes(l.prevCr)}</td>
              <td className="n">{formatKes(l.dr)}</td>
              <td className="n">{formatKes(l.cr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
