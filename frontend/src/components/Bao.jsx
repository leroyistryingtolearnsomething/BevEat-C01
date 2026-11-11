// KiddyEats mascot, same artwork as Logo/Bao in Figma. Decorative unless given a label.
// `elder` is the grown-up Bao (the parent side): a moustache and no blush.
export default function Bao({ size = 90, label, elder = false }) {
  return (
    <svg
      width={size}
      height={(size * 84) / 90}
      viewBox="0 0 90 84"
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d="M6 55.5C6 30.75 24.75 13.5 45 13.5C65.25 13.5 84 30.75 84 55.5C84 73.5 67.5 81 45 81C22.5 81 6 73.5 6 55.5Z" fill="#FFFDF5" stroke="#1F2041" strokeWidth="4" />
      <path d="M57 25.5C51.75 24 47.25 20.25 45 13.5C42.75 20.25 38.25 24 33 25.5M45 13.5V24.75" stroke="#1F2041" strokeWidth="3.5" strokeLinecap="round" />
      <g transform={elder ? "translate(0 -2)" : undefined}>
        <ellipse cx="33.75" cy="49.5" rx="4.125" ry="5.625" fill="#1F2041" />
        <ellipse cx="56.25" cy="49.5" rx="4.125" ry="5.625" fill="#1F2041" />
        <circle cx="35.25" cy="47.25" r="1.5" fill="#fff" />
        <circle cx="57.75" cy="47.25" r="1.5" fill="#fff" />
      </g>
      <path d={elder ? "M40.5 65C43.5 68 46.5 68 49.5 65" : "M39 60C43 64.5 47 64.5 51 60"} stroke="#1F2041" strokeWidth={elder ? 3 : 3.5} strokeLinecap="round" />
      {elder ? (
        <path d="M45 57.5C42 54.5 36.5 54.5 33 57.5C31 59.2 29.5 58.8 29 57C31 59.8 37 60.8 45 57.5ZM45 57.5C48 54.5 53.5 54.5 57 57.5C59 59.2 60.5 58.8 61 57C59 59.8 53 60.8 45 57.5Z" fill="#1F2041" />
      ) : (
        <>
          <ellipse cx="24" cy="60" rx="6" ry="3.75" fill="#FF9EC4" />
          <ellipse cx="66" cy="60" rx="6" ry="3.75" fill="#FF9EC4" />
        </>
      )}
    </svg>
  );
}
