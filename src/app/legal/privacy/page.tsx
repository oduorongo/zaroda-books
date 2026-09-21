export const metadata = {
  title: "Privacy policy — Zaroda Books",
  description:
    "What Zaroda Books collects, why, who else sees it, and the rights you have under "
    + "Kenya's Data Protection Act 2019.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "21 September 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="sub">Last updated {UPDATED}</p>

      <p>
        Zaroda Books is run by <strong>Zaroda Solutions</strong>. This policy says what we
        collect, why we hold it, who else can see it, and what you can require of us. It is
        written to be read, not to be got past.
      </p>

      <h2>Who is responsible for what</h2>
      <p>
        There are two kinds of information here, and they are not ours in the same way.
      </p>
      <p>
        <strong>Your account.</strong> Your name, email address, telephone number and the
        county you work in. We decide what to do with these, so for this information we are the
        data controller.
      </p>
      <p>
        <strong>A school&rsquo;s books.</strong> The receipts, payments, vote heads, enrolment
        figures and balances you enter. These belong to the school. We hold and process them on
        your instruction and do not use them for anything of our own, so for this information we
        are a data processor and the school — or the person keeping its books — is the
        controller.
      </p>

      <h2>What we collect, and why</h2>
      <table>
        <thead><tr><th>What</th><th>Why</th></tr></thead>
        <tbody>
          <tr>
            <td>Name, email, telephone number</td>
            <td>To give you an account, reach you about it, and send an M-Pesa request</td>
          </tr>
          <tr>
            <td>Password</td>
            <td>Stored only as a scrypt hash. We cannot read it and neither can anyone else</td>
          </tr>
          <tr>
            <td>County and sub-county</td>
            <td>To show a school its own books, and to let a Ministry auditor see their area</td>
          </tr>
          <tr>
            <td>School name, level, accounts, vote heads</td>
            <td>To produce the books of accounts you came here for</td>
          </tr>
          <tr>
            <td>Receipts, payments, balances, enrolment</td>
            <td>The books themselves. Entered by you, derived into the reports</td>
          </tr>
          <tr>
            <td>M-Pesa number and receipt number</td>
            <td>To take the subscription and issue you a receipt for it</td>
          </tr>
          <tr>
            <td>Sign-in device, IP address, browser</td>
            <td>To show you your signed-in devices and let you sign one out</td>
          </tr>
          <tr>
            <td>Failed sign-in attempts</td>
            <td>To stop password guessing. Kept fifteen minutes, then deleted</td>
          </tr>
          <tr>
            <td>An audit log of changes</td>
            <td>So a school can see who changed what, which is what a book of account requires</td>
          </tr>
        </tbody>
      </table>
      <p>
        We do not collect anything about learners beyond an enrolment count, and we hold no
        learner names, no parent details and no fee records per child.
      </p>

      <h2>We do not sell anything, or advertise</h2>
      <p>
        We do not sell, rent or trade any of it. We do not advertise, we run no advertising
        trackers, and we do not build profiles. Zaroda Books earns its money from subscriptions
        and from nothing else.
      </p>

      <h2>Who else sees it</h2>
      <p>
        Only those who have to, and only what they need:
      </p>
      <ul>
        <li>
          <strong>People you invite.</strong> You decide their role and whether they see every
          school on your account or only one.
        </li>
        <li>
          <strong>Ministry internal auditors.</strong> An auditor granted a sub-county or county
          by us can read the books of schools in that area. They can change nothing, every school
          they open is recorded, and you can see who holds that access on your book settings page.
        </li>
        <li>
          <strong>Zaroda Solutions staff.</strong> We can open your books to help you, read only,
          and every such session is written to your audit log.
        </li>
        <li>
          <strong>Our suppliers,</strong> listed below.
        </li>
      </ul>

      <h2>Suppliers who process data for us</h2>
      <table>
        <thead><tr><th>Who</th><th>What they handle</th><th>Where</th></tr></thead>
        <tbody>
          <tr><td>Neon</td><td>The database — everything above</td><td>Outside Kenya</td></tr>
          <tr><td>Vercel</td><td>Runs the website</td><td>Outside Kenya</td></tr>
          <tr><td>Tuma</td><td>M-Pesa subscription payments</td><td>Kenya</td></tr>
          <tr><td>Safaricom</td><td>M-Pesa itself</td><td>Kenya</td></tr>
          <tr><td>Resend</td><td>Sends our email</td><td>Outside Kenya</td></tr>
        </tbody>
      </table>
      <p>
        <strong>Some of your information is stored outside Kenya.</strong> The Data Protection
        Act 2019 permits this where appropriate safeguards are in place, and our suppliers are
        bound by contract to protect it and to process it only on our instruction.
      </p>

      <h2>How long we keep it</h2>
      <p>
        A school&rsquo;s books are kept for as long as you keep the account, and afterwards for
        as long as you may need them: books of account are records an auditor can ask for years
        later, and deleting them on the day a subscription lapses would do you harm. A closed
        year stays readable at no further cost.
      </p>
      <p>
        Failed sign-in attempts are deleted after fifteen minutes. Password reset links expire
        after an hour. Invitations expire after fourteen days.
      </p>
      <p>
        If you ask us to delete your account, we will — but tell us plainly, because for books
        of account it is not always the right thing, and it cannot be undone.
      </p>

      <h2>What you can require of us</h2>
      <p>Under the Data Protection Act 2019 you may ask us to:</p>
      <ul>
        <li>tell you what we hold about you, and give you a copy</li>
        <li>correct anything that is wrong</li>
        <li>delete what we hold, where we are not required to keep it</li>
        <li>stop processing it, or object to how we do</li>
        <li>hand it over in a form you can take elsewhere</li>
      </ul>
      <p>
        Write to <a href="mailto:support@zarodabooks.com">support@zarodabooks.com</a>. We will
        answer within thirty days. If you are not satisfied you may complain to the Office of the
        Data Protection Commissioner at <a href="https://www.odpc.go.ke">odpc.go.ke</a>.
      </p>

      <h2>Keeping it safe</h2>
      <ul>
        <li>Everything travels over HTTPS</li>
        <li>Passwords are stored as scrypt hashes, never in a readable form</li>
        <li>Sign-in tokens and password reset links are stored hashed too</li>
        <li>Each account reaches only its own books; the boundary is enforced on the server</li>
        <li>You can see and sign out every device on your account</li>
        <li>Password attempts are limited, to stop guessing</li>
      </ul>
      <p>
        No system is perfect. If something goes wrong that puts your information at risk, we
        will tell you and the Data Protection Commissioner, as the Act requires.
      </p>

      <h2>Cookies</h2>
      <p>
        One cookie, to keep you signed in, and a second short-lived one when a Zaroda
        administrator or an auditor is viewing books read-only. No advertising or analytics
        cookies of any kind.
      </p>

      <h2>Children</h2>
      <p>
        Zaroda Books is for school staff and accountants, not learners. We do not knowingly
        create accounts for anyone under eighteen.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy we will change the date at the top, and tell you by email where
        the change matters.
      </p>

      <h2>Contact</h2>
      <p>
        Zaroda Solutions<br />
        <a href="mailto:support@zarodabooks.com">support@zarodabooks.com</a><br />
        0724 282 065 · WhatsApp 0781 230 805
      </p>
    </>
  );
}
