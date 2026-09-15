import Link from "next/link";
import { getFirstAccount } from "@/server/queries";

export default async function Home() {
  const { account, school } = await getFirstAccount();

  return (
    <main>
      <h1>ZARODA BOOKS</h1>
      <p className="sub">Cash book, ledger and trial balance for school vote accounts.</p>

      <h2>{school.name} &mdash; {account.name} account, 2025/26</h2>
      <ul>
        <li><Link href={`/accounts/${account.id}/cash-book`}>Analysed cash book</Link></li>
        <li><Link href={`/accounts/${account.id}/ledger`}>Ledger accounts</Link></li>
        <li><Link href={`/accounts/${account.id}/trial-balance`}>Trial balance</Link></li>
      </ul>
    </main>
  );
}
