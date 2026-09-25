import type { SchoolLevel } from "@/domain";

/**
 * Each level's books are told apart in black and white, since schools print
 * without colour: a band, a letter in its own shape, and a letterhead rule of
 * its own. The PDF draws the same marks — see pdf-button.tsx.
 */
export const LEVEL_MARK: Record<SchoolLevel, { label: string; letter: string }> = {
  primary: { label: "PRIMARY SCHOOL", letter: "P" },
  junior: { label: "JUNIOR SCHOOL", letter: "J" },
  senior: { label: "SENIOR SCHOOL", letter: "S" },
};

export function LevelBand({ level }: { level: SchoolLevel }) {
  const mark = LEVEL_MARK[level];
  return (
    <div className={`level-band level-${level}`}>
      <span className="level-letter"><span>{mark.letter}</span></span>
      <span className="level-name">{mark.label}</span>
    </div>
  );
}

/** The footnote every printed Zaroda document carries, as in Zaroda School. */
export function PoweredBy() {
  return (
    <div className="z-powered">
      Powered by ZARODA SOLUTIONS<br />Reliable. Innovative. Forward.
    </div>
  );
}
