import Link from "next/link";
import { priceLabel } from "@/domain";

export const metadata = {
  title: "Terms of service — Zaroda Books",
  description:
    "The terms on which Zaroda Solutions provides Zaroda Books: subscriptions, what the "
    + "software does and does not do, and who owns the books.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "21 September 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p className="sub">Last updated {UPDATED}</p>

      <p>
        These are the terms on which <strong>Zaroda Solutions</strong> provides Zaroda Books.
        Using the software means accepting them.
      </p>

      <h2>1. What Zaroda Books is</h2>
      <p>
        Software for keeping the books of accounts of Kenyan primary, junior and senior
        schools. You enter receipts and payments; it prepares the cash book, ledger, trial
        balance, income and expenditure, bank reconciliation, cash flow statement and the
        acknowledgement returned to the Ministry.
      </p>
      <p>
        <strong>It is a tool, not an accountant.</strong> It does not audit your books, does not
        certify them, and does not relieve you of any statutory duty. The figures it produces
        are derived from what you enter: entered wrongly, they will be wrong, and the
        responsibility for what is entered and for what is submitted to anybody is yours.
      </p>

      <h2>2. Your account</h2>
      <p>
        Keep your password to yourself and do not let others use your login. If you think
        somebody else has it, change it and sign out your other devices — both are on your
        account pages. Tell us if you believe an account has been misused.
      </p>
      <p>
        You are responsible for the people you invite and for the rights you give them.
      </p>

      <h2>3. Subscriptions and payment</h2>
      <p>
        <strong>Your first book is free</strong> — one account, at one level, for one financial
        year, once. After that a subscription covers every account one school keeps at one level
        for one financial year:
      </p>
      <ul>
        <li>Primary school — KSh {priceLabel("primary")} a year</li>
        <li>Junior school — KSh {priceLabel("junior")} a year</li>
        <li>Senior school — KSh {priceLabel("senior")} a year</li>
      </ul>
      <p>
        A subscription binds to the first school it is used for and stays with that school.
        This is deliberate: it is what stops one payment serving a second school once the first
        one&rsquo;s figures have been copied out. A second school needs its own subscription.
      </p>
      <p>
        Payment is by M-Pesa. Prices may change, and we will tell you before a change affects
        what you pay. A subscription is for a financial year and is not refundable once books
        have been opened against it — if something has gone wrong, talk to us.
      </p>

      <h2>4. The books are yours</h2>
      <p>
        Everything you enter belongs to you, or to the school you keep books for. We claim no
        ownership of it and will not use it for any purpose of our own. You can export every
        book to PDF or CSV at any time, and we would rather you did that regularly than relied
        on us alone.
      </p>
      <p>
        If your subscription lapses, your books are not deleted. Closed years stay readable at
        no further cost.
      </p>

      <h2>5. Access by Ministry auditors</h2>
      <p>
        We may grant a Ministry internal auditor read-only access to the books of schools in
        their sub-county or county. They cannot change anything, every school they open is
        written to that school&rsquo;s audit log, and you can see who currently holds such
        access on your book settings page. Public school funds are public money and the
        Ministry has a right to examine how they are kept.
      </p>

      <h2>6. What we undertake, and what we do not</h2>
      <p>
        We will keep the service running as well as we reasonably can, and fix what breaks. We
        do not promise it will never be unavailable: it depends on the internet, on our hosting
        and database suppliers, and on Safaricom for payments, none of which we control.
      </p>
      <p>
        We take backups, but <strong>keep your own copies of anything you cannot afford to
        lose</strong>. The export buttons are there for that.
      </p>
      <p>
        Nothing here limits any liability that cannot lawfully be limited. Beyond that, our
        liability to you is limited to what you have paid us in the twelve months before the
        claim, and we are not liable for loss of profit, of business, or for indirect loss.
      </p>

      <h2>7. Using it properly</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use it to record anything false, or to conceal anything</li>
        <li>share one subscription between schools it was not bought for</li>
        <li>try to reach books or accounts that are not yours</li>
        <li>attempt to break, overload or probe the service</li>
        <li>resell or rebrand it without our written agreement</li>
      </ul>

      <h2>8. Ending it</h2>
      <p>
        You may stop using Zaroda Books at any time, and ask us to delete your account. We may
        suspend or end an account that breaks these terms, or where a subscription goes unpaid,
        and we will give you notice and a chance to put it right first except where the breach
        is serious. In any case we will give you a reasonable opportunity to export your books.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These terms are governed by the laws of Kenya, and the courts of Kenya have
        jurisdiction. Our handling of personal information is described in our{" "}
        <Link href="/privacy">privacy policy</Link>, which forms part of these terms.
      </p>

      <h2>10. Contact</h2>
      <p>
        Zaroda Solutions<br />
        <a href="mailto:info@zarodasolutions.com">info@zarodasolutions.com</a><br />
        0724 282 065 · WhatsApp 0781 230 805
      </p>
    </>
  );
}
