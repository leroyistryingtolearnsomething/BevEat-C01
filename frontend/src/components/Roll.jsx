// A number whose changing digits roll to their new value (up when they grow, down when they shrink, because each digit is
// a column of 0-9 that slides). Characters are matched from the right, so the cents stay put when 9.50 becomes 10.50.
// Nothing animates on the first render: the column starts at its digit and only moves when the digit changes.
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function Roll({ text }) {
  const chars = [...String(text)];
  return (
    <>
      <span className="sr-only">{text}</span>
      <span className="roll" aria-hidden="true">
        {chars.map((c, i) => {
          const key = chars.length - i;
          if (!/\d/.test(c)) return <span key={key}>{c}</span>;
          return (
            <span key={key} className="roll__d">
              <span className="roll__col" style={{ transform: `translateY(${-Number(c)}em)` }}>
                {DIGITS.map((d) => <span key={d}>{d}</span>)}
              </span>
            </span>
          );
        })}
      </span>
    </>
  );
}
