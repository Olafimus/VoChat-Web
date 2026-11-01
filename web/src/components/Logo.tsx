/** VoChat-Zeichen: Sprechblase (Chat) mit „V“-Häkchen (gelernt) und Limetten-Punkt (Serie). */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <defs>
        <linearGradient id="vochat-logo-g" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b3df5" />
          <stop offset=".55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#c056f0" />
        </linearGradient>
      </defs>
      <path
        d="M32 5C17 5 6 15.2 6 28.4c0 7.6 3.7 14.3 9.6 18.6L13.4 58c-.3 1.4 1.2 2.4 2.4 1.6l10.6-7c1.8.3 3.7.5 5.6.5 15 0 26-10.2 26-23.4S47 5 32 5Z"
        fill="url(#vochat-logo-g)"
      />
      <path d="M20.5 22.5 30 39.5 44.5 16.5" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="48.5" cy="12.5" r="5" fill="#b7e630" stroke="#fff" strokeWidth="2.5" />
    </svg>
  );
}
