import "server-only";
import { recordProblem } from "@/server/problems";
import { resolveRecipient } from "@/domain";

/**
 * Email through Resend's HTTPS API, as ZARODA SMS does it.
 *
 * A plain fetch rather than the SDK: one less dependency, and the API is a
 * single POST. HTTPS rather than SMTP because cloud hosts commonly block or
 * silently drop outbound SMTP, which is the failure that is impossible to
 * diagnose from inside the application.
 *
 * It never throws. A password reset that cannot be emailed should tell the
 * person plainly, not crash the page.
 *
 * Env: RESEND_API_KEY, RESEND_FROM.
 */

export interface SendResult {
  ok: boolean;
  detail?: string;
}

export const emailConfigured = (): boolean => Boolean(process.env.RESEND_API_KEY);

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, detail: "Email is not configured (RESEND_API_KEY missing)." };

  // Every message may be diverted to one address — see email-recipient.ts.
  const { to: recipient, redirectedFrom } = resolveRecipient(
    input.to,
    process.env.EMAIL_REDIRECT_TO,
  );

  // Resend's shared sender works without verifying a domain, which is what
  // makes this testable before the DNS records are in place.
  const from = process.env.RESEND_FROM || "Zaroda Books <onboarding@resend.dev>";

  // Sending happens from whichever domain is verified with Resend, which need
  // not be the one people should write back to. Replies go to the address the
  // site advertises and that forwards to a real inbox.
  const replyTo = process.env.RESEND_REPLY_TO || "support@zarodabooks.com";

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        reply_to: replyTo,
        to: [recipient],
        // Marked in the subject as well as the body: a diverted password
        // reset must never be mistaken for one's own.
        subject: redirectedFrom ? `[for ${redirectedFrom}] ${input.subject}` : input.subject,
        html: redirectedFrom ? redirectedNotice(redirectedFrom) + input.html : input.html,
        text: redirectedFrom
          ? `[Diverted. This was addressed to ${redirectedFrom}.]\n\n${input.text}`
          : input.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      await recordProblem({
        area: "email",
        message: `Resend refused an email to ${recipient} (${resp.status}).`,
        detail: body.slice(0, 500),
      });
      return { ok: false, detail: `The email could not be sent (${resp.status}).` };
    }
    return { ok: true };
  } catch (err) {
    await recordProblem({
      area: "email",
      message: `The email service could not be reached, sending to ${recipient}.`,
      detail: err,
    });
    return { ok: false, detail: "The email service could not be reached." };
  }
}

const redirectedNotice = (intended: string) =>
  `<div style="background:#a32b18;color:#fff;padding:12px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:14px">`
  + `<strong>Diverted.</strong> This was addressed to ${intended}. `
  + "EMAIL_REDIRECT_TO is set, so no real recipient received it."
  + `</div>`;

/** For the owner console: whether mail is being diverted, and where to. */
export const emailRedirectedTo = (): string | null => {
  const { to, redirectedFrom } = resolveRecipient("someone@example.com", process.env.EMAIL_REDIRECT_TO);
  return redirectedFrom ? to : null;
};

/** The house style: navy band, one clear action, plain text alongside. */
export function emailLayout(opts: {
  heading: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  footer: string;
}): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#fbfaf7;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#10223f">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#10223f;color:#fbfaf7;padding:20px 24px;border-radius:5px 5px 0 0">
      <div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#d9a520">Zaroda Books</div>
    </div>
    <div style="background:#ffffff;border:1px solid #e3ded1;border-top:0;border-radius:0 0 5px 5px;padding:24px">
      <h1 style="margin:0 0 12px;font-size:20px">${opts.heading}</h1>
      <p style="margin:0 0 20px;line-height:1.6;font-size:15px">${opts.body}</p>
      <a href="${opts.buttonUrl}"
         style="display:inline-block;background:#a8801a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:3px;font-weight:600">
        ${opts.buttonLabel}
      </a>
      <p style="margin:22px 0 0;font-size:13px;color:#5d6673;line-height:1.6">${opts.footer}</p>
      <p style="margin:14px 0 0;font-size:12px;color:#5d6673;word-break:break-all">
        If the button does not work, paste this into your browser:<br>${opts.buttonUrl}
      </p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#5d6673;text-align:center">
      Zaroda Solutions · support@zarodabooks.com · 0724 282 065
    </p>
  </div>
</body></html>`;
}
