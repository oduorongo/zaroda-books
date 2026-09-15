import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>ZARODA BOOKS</h1>
      <p className="sub">Cash book, ledger and trial balance for school vote accounts.</p>

      <h2>Ong&rsquo;ora Kakuru Primary &mdash; SIMBA account, 2025/26</h2>
      <p>
        Sample data from a real set of books, so you can see the reports before connecting a
        database.
      </p>
      <ul>
        <li><Link href="/accounts/demo/cash-book">Analysed cash book</Link></li>
        <li><Link href="/accounts/demo/ledger">Ledger accounts</Link></li>
        <li><Link href="/accounts/demo/trial-balance">Trial balance</Link></li>
      </ul>
    </main>
  );
}
