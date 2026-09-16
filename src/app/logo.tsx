import Image from "next/image";

// Both assets are white with a soft shadow: they only read on the navy surfaces.
const ASSETS = {
  mark: { src: "/zaroda-mark.png", ratio: 272 / 260 },
  lockup: { src: "/zaroda-lockup.png", ratio: 600 / 461 },
};

/**
 * `mark` is the Z alone, for small sizes where the lockup's tagline turns to mush;
 * `lockup` is the full Zaroda Solutions signature.
 */
export function Logo({
  height, variant = "mark", priority,
}: {
  height: number;
  variant?: keyof typeof ASSETS;
  priority?: boolean;
}) {
  const { src, ratio } = ASSETS[variant];
  return (
    <Image
      src={src}
      alt="Zaroda Solutions"
      width={Math.round(height * ratio)}
      height={height}
      priority={priority}
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
