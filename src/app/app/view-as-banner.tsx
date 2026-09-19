import { endViewAsAction } from "./view-as-actions";

/**
 * Impossible to miss, because the danger of a view-as session is forgetting you
 * are in one and reading another school's figures as your own.
 */
export function ViewAsBanner({ orgName }: { orgName: string }) {
  return (
    <div
      style={{
        background: "var(--gold)", color: "#fff", padding: ".6rem 2.75rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "1rem", flexWrap: "wrap", fontSize: ".88rem",
      }}
    >
      <div>
        Viewing <strong>{orgName}</strong> as the system owner. Read only — nothing can be posted
        or changed.
      </div>
      <form action={endViewAsAction}>
        <button type="submit" className="btn-link" style={{ color: "#fff", fontSize: ".88rem" }}>
          Stop viewing
        </button>
      </form>
    </div>
  );
}
