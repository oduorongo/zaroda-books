import { remindHoiOfQueries } from "@/server/audit-queries";

/**
 * Run daily by Vercel Cron (vercel.json), which sends CRON_SECRET as a bearer
 * token. Refused when the secret is unset as well as when it is wrong: an
 * unset secret must not leave the route open to anyone.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }
  const chased = await remindHoiOfQueries();
  return Response.json({ chased });
}
