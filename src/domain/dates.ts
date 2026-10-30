/**
 * Dates as the school reads them: dd/mm/yyyy, everywhere on screen and on
 * paper. Stored dates stay ISO (yyyy-mm-dd) so they sort and compare as text.
 */

const parts = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { date: `${p.day}/${p.month}/${p.year}`, time: `${p.hour}:${p.minute}` };
};

/** A stored yyyy-mm-dd is a calendar day, not a moment, so it is reordered rather than converted. */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  }
  return parts(d).date;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const p = parts(new Date(d));
  return `${p.date} ${p.time}`;
}
