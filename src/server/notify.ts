import "server-only";
import { emailLayout, sendEmail } from "@/server/email";
import { SITE_URL } from "@/app/site-url";

/**
 * Telling Zaroda that something needs attention.
 *
 * The owner console already sorts a pending signup to the top and counts it
 * in the header, but that only helps somebody who opens it. A new tenant is
 * waiting on a person, and until they are approved their free school is held
 * back — so the person has to be told rather than be expected to check.
 *
 * Env: ADMIN_NOTIFY_EMAIL. Unset, nothing is sent and nothing breaks.
 */
export async function notifyOwner(input: {
  subject: string;
  heading: string;
  body: string;
  linkLabel: string;
  linkPath: string;
}): Promise<void> {
  const to = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (!to) return;

  const url = `${SITE_URL}${input.linkPath}`;

  // Never awaited by the caller's happy path, and never allowed to throw: a
  // signup must not fail because we could not send ourselves a note.
  try {
    await sendEmail({
      to,
      subject: input.subject,
      html: emailLayout({
        heading: input.heading,
        body: input.body,
        buttonLabel: input.linkLabel,
        buttonUrl: url,
        footer: "Sent to you because ADMIN_NOTIFY_EMAIL is set on Zaroda Books.",
      }),
      text: `${input.body.replace(/<[^>]+>/g, "")}\n\n${input.linkLabel}: ${url}`,
    });
  } catch {
    // sendEmail already records a problem; nothing further to do here.
  }
}

/** A new tenant has signed up and is waiting to be approved. */
export async function notifyNewTenant(input: {
  orgId: string;
  orgName: string;
  personName: string;
  email: string;
  county: string;
  subCounty: string;
}): Promise<void> {
  await notifyOwner({
    subject: `New signup: ${input.orgName}`,
    heading: "Somebody has signed up",
    body:
      `<strong>${input.personName}</strong> (${input.email}) has created `
      + `<strong>${input.orgName}</strong> in ${input.subCounty}, ${input.county}.`
      + "<br><br>Their free school is held back until you approve the account.",
    linkLabel: "Review and approve",
    linkPath: `/admin/${input.orgId}`,
  });
}
