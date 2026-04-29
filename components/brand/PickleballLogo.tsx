interface PickleballLogoProps {
  size?: number;
  className?: string;
}

/** Pickleball-themed brand mark: SVG ball with paddle silhouette. */
export function PickleballLogo({ size = 28, className }: PickleballLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="FreeMinigame"
    >
      <defs>
        <radialGradient id="pb-ball" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#F0FF80" />
          <stop offset="60%" stopColor="#C5E830" />
          <stop offset="100%" stopColor="#7FA51E" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#pb-ball)" />
      {/* Pickleball holes */}
      {[
        [16, 7], [10, 10], [22, 10], [7, 16], [25, 16],
        [10, 22], [22, 22], [16, 25], [16, 16],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="1.4"
          fill="rgba(40, 60, 10, 0.45)"
        />
      ))}
    </svg>
  );
}
