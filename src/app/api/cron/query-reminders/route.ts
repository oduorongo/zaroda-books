import { remindHoiOfQueries } from "@/server/audit-queries";

/**
 * Run daily by Vercel Cron (vercel.json). Vercel sends CRON_SECRET as a
 * bearer token when it is set; without it anyone could trigger the run, which
 * at worst sends a reminder that was due anyway, since each query is chased
 * once a week at most.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }
  const chased = await remindHoiOfQueries();
  return Response.json({ chased });
}
