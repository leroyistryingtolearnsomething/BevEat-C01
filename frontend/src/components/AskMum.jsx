import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAskMumPending } from "../api.js";
import { money } from "./ParentShell.jsx";

// Parent side of Ask Mum (Leslie, CB69-26, Figma 09a). The "ping" is the app checking for new
// requests every 15 s, the same way the kid app checks for ready orders.
const POLL_MS = 15000;

// -> today's pending requests from all of this parent's kids (null while loading)
export function useAskMumPending(token) {
  const [requests, setRequests] = useState(null);
  useEffect(() => {
    const check = () =>
      getAskMumPending(token)
        .then((d) => setRequests(d.requests))
        .catch(() => {}); // try again next time
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [token]);
  return requests ?? [];
}

const BellIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

// The bell in the header, with a red count. Tapping it opens the newest request.
export function AskMumBell({ requests }) {
  const n = requests.length;
  if (n === 0)
    return (
      <span className="am-bell" aria-label="No Ask Mum requests">
        <BellIcon />
      </span>
    );
  return (
    <Link to={`/parent/ask-mum/${requests[0].requestId}`} className="am-bell"
      aria-label={`${n} Ask Mum request${n > 1 ? "s" : ""} waiting`}>
      <BellIcon />
      <span className="am-bell__badge">{n}</span>
    </Link>
  );
}

const time = (iso) => new Date(iso).toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });

// The green "Ethan is asking you" card(s) on parent home
export function AskMumPings({ requests }) {
  if (requests.length === 0) return null;
  return (
    <section className="am-pings" aria-label="Ask Mum requests" role="status">
      {requests.map((r) => (
        <article key={r.requestId} className="am-ping">
          <p className="am-ping__top">
            <BellIcon size={18} />
            <span>{r.childName} is asking you</span>
            <time dateTime={r.createdAt}>{time(r.createdAt)}</time>
          </p>
          <div className="am-ping__dish">
            <DishThumb imageUrl={r.imageUrl} size={54} />
            <div>
              <p className="am-ping__name">{r.dishName}</p>
              <p className="am-ping__meta">{money(r.price)} · {r.stallName}</p>
            </div>
          </div>
          {r.ruleLabel && <p className="am-ping__rule">🔒 Breaks your rule: {r.ruleLabel}</p>}
          <Link to={`/parent/ask-mum/${r.requestId}`} className="am-ping__btn">Review request</Link>
        </article>
      ))}
    </section>
  );
}

// The dish photo, or a bowl on yellow when the dish has no photo
export function DishThumb({ imageUrl, size, wide }) {
  const [broken, setBroken] = useState(false);
  const style = wide ? { height: size } : { width: size, height: size };
  if (imageUrl && !broken)
    return <img className="am-thumb" src={imageUrl} alt="" style={style} onError={() => setBroken(true)} />;
  return (
    <span className="am-thumb am-thumb--empty" style={style} aria-hidden="true">
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="#8A4A0F" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 11h18a9 9 0 0 1-18 0Z" strokeLinejoin="round" />
        <path d="M8 11V4M12 11V3M16 11l3-6M8 21h8" />
      </svg>
    </span>
  );
}
