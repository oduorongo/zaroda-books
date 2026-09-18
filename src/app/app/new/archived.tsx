"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth";
import { getArchivedBooks, restoreBook } from "@/server/books";

async function restore(form: FormData): Promise<void> {
  "use server";
  const user = await getCurrentUser();
  if (!user) return;
  await restoreBook({
    accountId: String(form.get("accountId") ?? ""),
    orgId: user.orgId,
    userId: user.id,
  });
  revalidatePath("/app", "layout");
}

/** Books taken out of the list, offered back. Nothing was destroyed. */
export async function ArchivedBooks({ orgId }: { orgId: string }) {
  const books = await getArchivedBooks(orgId);
  if (!books.length) return null;

  return (
    <div className="card" style={{ marginTop: "2rem", maxWidth: 820 }}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Archived books</h2>
      <p className="note">
        These are hidden from your list but keep every entry. Bring one back to work on it again.
      </p>
      <table>
        <tbody>
          {books.map(({ account, school }) => (
            <tr key={account.id}>
              <td>{school.name} — {account.name}</td>
              <td className="note">
                archived {account.archivedAt?.toLocaleDateString("en-KE", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </td>
              <td className="n">
                <form action={restore}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <button type="submit" className="btn-link">Restore</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
