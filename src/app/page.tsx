import Link from "next/link";
import { Logo } from "./logo";

const steps = [
  { no: "01", title: "Create the book", body: "School, level, account type and financial year. The chart of accounts and the twelve periods open with it." },
  { no: "02", title: "Enter receipts", body: "Amount received and the rates in force. The enrolment is derived from the amount and the vote heads used, exact to the shilling." },
  { no: "03", title: "Record payments", body: "Each voucher charged to one vote head, paid from cash or bank. Virement between vote heads is allowed and logged." },
  { no: "04", title: "Post the books", body: "Cash book, ledger, trial balance, income and expenditure, bank reconciliation and cash flow, all from the same entries." },
];

const levels = [
  { name: "Primary school", price: "480", note: "Every account kept at primary level, for one financial year." },
  { name: "Junior school", price: "580", note: "Every account kept at junior level, for one financial year." },
  { name: "Senior school", price: "1,060", note: "Every account kept at senior level, for one financial year." },
];

const outputs = [
  { name: "Analysed cash book", note: "Both sides, cash and bank columns, monthly totals", tag: "Monthly" },
  { name: "Ledger", note: "Cumulative Dr and Cr per vote head", tag: "Running" },
  { name: "Trial balance", note: "Year to date with the balance check", tag: "Monthly" },
  { name: "Cash flow statement", note: "Opening, movements, closing cash and bank", tag: "Termly" },
  { name: "Acknowledgement receipt", note: "Enrolment used and the split, to return to the Ministry", tag: "Per receipt" },
];

export default function Home() {
  return (
    <main>
      <div className="dark-band">
        <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".9rem" }}>
            <Logo height={38} priority />
            <div className="mono" style={{ letterSpacing: ".14em", fontSize: ".8rem", textTransform: "uppercase", borderLeft: "1px solid rgba(251,250,247,.3)", paddingLeft: ".9rem" }}>
              Zaroda&nbsp;Books
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.75rem", fontSize: ".9rem" }}>
            <a href="#how">How it works</a>
            <a href="#books">What it produces</a>
            <a href="#pricing">Pricing</a>
            <Link href="/login" style={{ color: "var(--paper)" }}>Log in</Link>
            <Link href="/signup" className="btn btn-gold" style={{ color: "#fff", textDecoration: "none", padding: ".7rem 1.25rem", fontSize: ".9rem" }}>
              Create account
            </Link>
          </div>
        </div>

        <div className="wrap" style={{ padding: "4.5rem 2.5rem 6rem", display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,.85fr)", gap: "4rem", alignItems: "center" }}>
          <div>
            <div className="mono" style={{ fontSize: ".75rem", letterSpacing: ".2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: "1.4rem" }}>
              For book keepers of Kenyan public schools
            </div>
            <h1 style={{ fontSize: "3.25rem", lineHeight: 1.04, fontWeight: 700, margin: "0 0 1.5rem", textWrap: "pretty" }}>
              The books of accounts, prepared by the system.
            </h1>
            <p style={{ fontSize: "1.15rem", lineHeight: 1.6, color: "var(--on-dark)", margin: "0 0 2rem", maxWidth: "52ch", textWrap: "pretty" }}>
              Zaroda Books is built for the people who keep the books for primary, junior and
              secondary schools. Enter the receipts and the payments once. The cash book, ledger,
              trial balance and cash flow statement are prepared automatically, per vote head, to
              the last shilling.
            </p>
            <div style={{ display: "flex", gap: ".9rem", flexWrap: "wrap" }}>
              <Link href="/signup" className="btn btn-gold" style={{ color: "#fff", textDecoration: "none" }}>
                Start a set of books
              </Link>
              <Link href="/login" className="btn" style={{ background: "none", border: "1px solid rgba(251,250,247,.35)", color: "var(--paper)", textDecoration: "none", fontWeight: 400 }}>
                Log in
              </Link>
            </div>
          </div>
          <div style={{ background: "var(--ink-deep)", border: "1px solid rgba(251,250,247,.14)", borderRadius: 6, padding: "1.6rem 1.75rem" }}>
            <div className="mono" style={{ fontSize: ".69rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--on-dark-dim)", marginBottom: "1.1rem" }}>
              Every book, from one set of entries
            </div>
            {outputs.map((o) => (
              <div key={o.name} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: ".6rem 0", borderBottom: "1px solid rgba(251,250,247,.08)", fontSize: ".85rem" }}>
                <span style={{ color: "var(--on-dark)" }}>{o.name}</span>
                <span className="mono" style={{ color: "var(--gold)", fontSize: ".7rem", letterSpacing: ".1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{o.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section id="how" className="wrap" style={{ padding: "5.5rem 2.5rem 1.25rem" }}>
        <h2 style={{ fontSize: "2rem", margin: "0 0 .75rem" }}>Four steps, one term</h2>
        <p style={{ color: "var(--muted)", fontSize: "1.05rem", margin: "0 0 2.75rem", maxWidth: "60ch" }}>
          The work follows the circular. Nothing is entered twice and nothing is posted by hand.
        </p>
        <div className="grid-4">
          {steps.map((s) => (
            <div key={s.no} className="card">
              <div className="code mono" style={{ fontSize: ".75rem", marginBottom: "1rem" }}>{s.no}</div>
              <h3 style={{ fontSize: "1.1rem", margin: "0 0 .6rem" }}>{s.title}</h3>
              <div style={{ color: "var(--muted)", fontSize: ".88rem", lineHeight: 1.6 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="books" className="wrap" style={{ padding: "4.75rem 2.5rem 6rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,.9fr) minmax(0,1.1fr)", gap: "4rem", alignItems: "start" }}>
          <div>
            <h2 style={{ fontSize: "2rem", margin: "0 0 .75rem" }}>What comes out</h2>
            <p style={{ color: "var(--muted)", fontSize: "1.05rem", lineHeight: 1.6, margin: 0 }}>
              Every book is derived from the receipts and payments you posted, so the figures agree
              across all of them. Print at the end of the month, the term or the financial year.
            </p>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {outputs.map((o) => (
              <div key={o.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1.25rem", padding: "1.1rem 1.5rem", borderBottom: "1px solid var(--rule-soft)" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 600 }}>{o.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: ".82rem", marginTop: ".2rem" }}>{o.note}</div>
                </div>
                <div className="mono" style={{ fontSize: ".69rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--gold)", whiteSpace: "nowrap" }}>{o.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" style={{ borderTop: "1px solid var(--rule-card)", background: "var(--band)" }}>
        <div className="wrap" style={{ padding: "4.75rem 2.5rem" }}>
          <div style={{ maxWidth: "60ch", marginBottom: "2.75rem" }}>
            <h2 style={{ fontSize: "2rem", margin: "0 0 .9rem" }}>One price per school level, per year</h2>
            <p style={{ color: "var(--muted)", fontSize: "1.05rem", lineHeight: 1.6, margin: "0 0 1.1rem" }}>
              The subscription covers <strong>every account in that school level</strong> — tuition,
              operations, infrastructure, boarding, lunch — not one account each. Freelance book
              keepers hold as many schools as they keep books for under a single login.
            </p>
            <p style={{ color: "var(--muted)", fontSize: ".95rem", lineHeight: 1.6, margin: 0 }}>
              A school running primary and junior levels subscribes to both. Closed years stay
              readable at no further cost.
            </p>
          </div>

          <div className="grid-3">
            {levels.map((l) => (
              <div key={l.name} className="card" style={{ padding: "1.9rem 2rem", display: "flex", flexDirection: "column" }}>
                <div className="eyebrow" style={{ color: "var(--gold)" }}>{l.name}</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: ".5rem", margin: ".9rem 0 .3rem" }}>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: "2.75rem", fontWeight: 700, lineHeight: 1 }}>
                    KSh&nbsp;{l.price}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: ".9rem", paddingBottom: ".45rem" }}>per year</div>
                </div>
                <div style={{ color: "var(--muted)", fontSize: ".88rem", lineHeight: 1.55 }}>{l.note}</div>
                <Link href="/signup" className="btn btn-gold" style={{ display: "block", textAlign: "center", marginTop: "1.5rem", color: "#fff", textDecoration: "none" }}>
                  Subscribe
                </Link>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "2.25rem", flexWrap: "wrap", marginTop: "2.25rem", fontSize: ".9rem", color: "var(--muted)" }}>
            <div>All the books of accounts, printable</div>
            <div>Unlimited schools on one login</div>
            <div>Unlimited receipts, payments and vouchers</div>
            <div>Acknowledgement receipts for the Ministry</div>
          </div>
        </div>
      </section>

      <footer className="dark-band">
        <div className="wrap" style={{ padding: "3.25rem 2.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-heading)", color: "var(--paper)", fontSize: "1.35rem", fontWeight: 600, marginBottom: ".4rem" }}>
              Open a set of books for your school.
            </div>
            <div style={{ fontSize: ".9rem", color: "var(--on-dark)" }}>Innovative. Reliable. Forward. — Zaroda Solutions</div>
          </div>
          <Link href="/signup" className="btn btn-gold" style={{ color: "#fff", textDecoration: "none" }}>Create account</Link>
        </div>
        <div style={{ borderTop: "1px solid rgba(251,250,247,.14)" }}>
          <div className="wrap" style={{ padding: "1.9rem 2.5rem", display: "flex", gap: "2.75rem", flexWrap: "wrap", alignItems: "center", fontSize: ".9rem" }}>
            <Logo height={86} variant="lockup" />
            <div>
              <div className="eyebrow" style={{ color: "var(--on-dark-dim)", marginBottom: ".35rem" }}>WhatsApp</div>
              <a href="https://wa.me/254781230805" style={{ color: "var(--paper)" }}>0781 230 805</a>
            </div>
            <div>
              <div className="eyebrow" style={{ color: "var(--on-dark-dim)", marginBottom: ".35rem" }}>Call</div>
              <a href="tel:+254724282065" style={{ color: "var(--paper)" }}>0724 282 065</a>
            </div>
            <div>
              <div className="eyebrow" style={{ color: "var(--on-dark-dim)", marginBottom: ".35rem" }}>Email</div>
              <a href="mailto:info@zarodasolutions.com" style={{ color: "var(--paper)" }}>info@zarodasolutions.com</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
