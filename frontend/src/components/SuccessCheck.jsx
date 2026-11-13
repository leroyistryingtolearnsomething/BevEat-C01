// The green success disc from Figma (assets/figma/success.svg) drawn inline, so the disc can pop and the check can draw itself.
// pathLength="1" lets the CSS draw the tick with a dash of 1, whatever its real length.
export default function SuccessCheck({ size = 88 }) {
  return (
    <svg className="ux-check" width={size} height={size} viewBox="0 0 88 88" fill="none" aria-hidden="true">
      <g className="ux-check__disc">
        <circle cx="44" cy="44" r="44" fill="#E2F2DA" />
        <circle cx="44" cy="44" r="32" fill="#237A33" />
      </g>
      <path className="ux-check__tick" d="M30 45L39.5 54.5L59 35" pathLength="1" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
