import { useEffect, useState } from "react";

// order stages from the queue endpoint, in order
export const STAGES = [
  ["received", "Order placed"],
  ["cooking", "Cooking"],
  ["ready", "Ready"],
  ["collected", "Collected"],
];
export const stageName = (stage) => (STAGES.find(([key]) => key === stage) || [, ""])[1];

// re-renders every second so the countdown moves
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// "11:42" left until readyBy, or null once the time is up (then we say "almost ready")
export function timeLeft(readyBy, now) {
  if (!readyBy) return null;
  const secs = Math.ceil((new Date(readyBy).getTime() - now) / 1000);
  if (secs <= 0) return null;
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

// short line for the home cards, e.g. "Order received · 1 before you · 11:42 left"
export function statusLine(o, now) {
  if (o.stage === "ready") return o.pickupCode ? `Ready! Show code ${o.pickupCode}` : "Ready to collect";
  const left = timeLeft(o.readyBy, now);
  const parts = [stageName(o.stage)];
  if (o.ahead > 0) parts.push(`${o.ahead} before ${o.childName ? "it" : "you"}`);
  parts.push(left ? `${left} left` : "almost ready");
  return parts.join(" · ");
}

// Order received -> Cooking -> Ready -> Collected, done steps filled in
export function StageSteps({ stage }) {
  // collected = every step done
  const at = stage === "collected" ? STAGES.length : STAGES.findIndex(([key]) => key === stage);
  return (
    <ol className="stage-steps" aria-label={`Order status: ${stageName(stage)}`}>
      {STAGES.map(([key, label], i) => (
        <li key={key} className={i < at ? "stage-steps__done" : i === at ? "stage-steps__now" : ""}>
          <span aria-hidden="true">{i < at ? "✓" : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
