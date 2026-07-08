import { cn } from "@/lib/utils";

/** makan mark — a rounded map-pin badge holding a desert horizon: sun over
 *  layered mountains (viewpoints) with a location dot. Self-contained colors so
 *  it reads on any background; doubles as the app/favicon icon. */
export function LogoMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id="makan-bg" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0" stopColor="#F0855F" />
          <stop offset="1" stopColor="#D6553B" />
        </linearGradient>
        <linearGradient id="makan-sky" x1="10" y1="12" x2="10" y2="30">
          <stop offset="0" stopColor="#FFE6C7" />
          <stop offset="1" stopColor="#FFC79A" />
        </linearGradient>
      </defs>

      {/* pin / rounded badge */}
      <path
        d="M24 3c9.94 0 18 7.61 18 17 0 8.3-6.6 15.9-16.2 24.4a2.7 2.7 0 0 1-3.6 0C12.6 35.9 6 28.3 6 20 6 10.61 14.06 3 24 3Z"
        fill="url(#makan-bg)"
      />

      {/* inner scene window */}
      <clipPath id="makan-clip">
        <circle cx="24" cy="20" r="12.5" />
      </clipPath>
      <g clipPath="url(#makan-clip)">
        <rect x="11.5" y="7.5" width="25" height="25" fill="url(#makan-sky)" />
        {/* sun */}
        <circle cx="30.5" cy="15" r="3.4" fill="#FFF4E4" />
        {/* far mountain */}
        <path d="M11 26 L20 17 L27 24 L33 19 L37 24 L37 33 L11 33 Z" fill="#E07B54" />
        {/* near mountain */}
        <path d="M11 33 L18 23.5 L26 31 L31 27 L37 32.5 L37 34 L11 34 Z" fill="#B23F27" />
      </g>

      {/* location dot */}
      <circle cx="24" cy="20" r="3" fill="#FFFFFF" />
      <circle cx="24" cy="20" r="1.4" fill="#D6553B" />
    </svg>
  );
}

/** Full lockup: mark + Arabic wordmark. */
export function Logo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span className="font-heading text-xl font-bold leading-none">مكان</span>
    </span>
  );
}
