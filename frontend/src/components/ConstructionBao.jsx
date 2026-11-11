import Bao from "./Bao.jsx";

// Bao in a hard hat next to a little crane that is lifting the thing being built:
// a star (for Stars) or a chat bubble (for Ask Bao). Decorative, so it is hidden from screen readers.
const INK = "#1F2041", SUN = "#FFC93C", CORAL = "#FF6B5B", SKY = "#5BC0EB";

export default function ConstructionBao({ thing = "star", size = 220 }) {
  return (
    <svg width={size} height={(size * 160) / 220} viewBox="0 0 220 160" fill="none" aria-hidden="true">
      {/* ground with a dashed yellow line */}
      <rect x="6" y="148" width="208" height="8" rx="4" fill={INK} />
      <path d="M16 152H204" stroke={SUN} strokeWidth="2.5" strokeDasharray="10 8" />

      {/* crane: tower with cross braces, arm, counterweight, pennant */}
      <rect x="162" y="22" width="14" height="126" fill={CORAL} stroke={INK} strokeWidth="2.5" />
      <path d="M162 22L176 54M176 22L162 54M162 54L176 86M176 54L162 86M162 86L176 118M176 86L162 118M162 118L176 148M176 118L162 148" stroke={INK} strokeWidth="1.8" />
      <rect x="64" y="20" width="146" height="10" rx="3" fill={SUN} stroke={INK} strokeWidth="2.5" />
      <rect x="190" y="30" width="18" height="14" fill={INK} />
      <path d="M169 20V6l12 4-12 4" fill={SKY} stroke={INK} strokeWidth="2" strokeLinejoin="round" />

      {/* what the crane is lifting */}
      <path d="M130 30V68" stroke={INK} strokeWidth="2" />
      {thing === "bubble" ? (
        <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
          <path d="M112 74h36a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8h-22l-8 8v-8h-6a8 8 0 0 1-8-8V82a8 8 0 0 1 8-8z" fill={SKY} />
          <g fill="#fff" stroke="none"><circle cx="122" cy="90" r="3" /><circle cx="130" cy="90" r="3" /><circle cx="138" cy="90" r="3" /></g>
        </g>
      ) : (
        <path d="M130 72l4.4 8.9 9.8 1.4-7.1 6.9 1.7 9.8-8.8-4.6-8.8 4.6 1.7-9.8-7.1-6.9 9.8-1.4z" fill={SUN} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      )}

      {/* traffic cone */}
      <path d="M138 148l6-16 6 16z" fill={CORAL} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M140.5 141h7" stroke="#fff" strokeWidth="2.5" />

      {/* Bao with a hard hat */}
      <g transform="translate(14 62)">
        <Bao size={90} />
        <path d="M20 25C20 11 31 3 45 3C59 3 70 11 70 25Z" fill={SUN} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <rect x="41" y="2" width="8" height="22" rx="3" fill="#FFD95F" stroke={INK} strokeWidth="2.5" />
        <rect x="14" y="23" width="62" height="6" rx="3" fill={SUN} stroke={INK} strokeWidth="3" />
      </g>
    </svg>
  );
}
