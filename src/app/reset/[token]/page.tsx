import Link from "next/link";
import { resetForToken } from "@/server/password-reset";
import { AuthLayout } from "../../auth-layout";
import { ResetForm } from "./form";

export default async function ResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const reset = await resetForToken(token);

  // One wording for expired, used and never-existed alike: the differences
  // would tell a stranger which links were once real.
  if (!reset) {
    return (
      <AuthLayout
        title="That link is no longer usable"
        subtitle="Reset links work once and lapse after an hour."
        aside="Ask for another and it will arrive in a moment."
      >
        <p className="note">
          <Link href="/forgot">Send me a new link</Link> · <Link href="/login">Back to log in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose one you have not used elsewhere."
      aside="Your books are where you left them."
    >
      <ResetForm token={token} />
    </AuthLayout>
  );
}
