import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getReadyOrders } from "../api.js";
import { getSession } from "../session.js";

// order ready ping: kid app checks every 10s, shows a banner when food is ready
const POLL_MS = 10000;
const HIDDEN_KEY = "kiddyeats.hiddenPings";

// orders the kid closed with the x, kept for this tab so they don't come back on refresh
function loadHidden() {
  try {
    return JSON.parse(sessionStorage.getItem(HIDDEN_KEY)) || [];
  } catch {
    return [];
  }
}

export default function ReadyPing() {
  const [ready, setReady] = useState([]);
  const [hidden, setHidden] = useState(loadHidden);
  const { pathname } = useLocation();

  useEffect(() => {
    async function check() {
      const s = getSession();
      if (!s || s.role !== "child") return setReady([]);
      try {
        const { orders } = await getReadyOrders(s.token);
        setReady(orders);
      } catch {
        // 401 clears the session in api.js, so the next check stops before calling the api
        // other errors (e.g. no internet): try again next time
      }
    }
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, []);

  function hide(orderId) {
    const next = [...hidden, orderId];
    setHidden(next);
    try {
      sessionStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      // private mode etc, it just comes back after a refresh
    }
  }

  const shown = ready.filter((o) => !hidden.includes(o.orderId));
  // no banner on the pickup page, it already shows the code
  if (shown.length === 0 || pathname.startsWith("/kid/pickup")) return null;
  return (
    <div className="ready-ping" role="alert">
      {shown.map((o) => (
        <div key={o.orderId} className="ready-ping__row">
          <Link to={`/kid/pickup/${o.orderId}`} className="ready-ping__link">
            <span className="ready-ping__title">🔔 Your food is ready!</span>
            <span className="ready-ping__text">
              {o.stallName}, number {o.queueNumber}
              {o.pickupCode && <> · show code <b>{o.pickupCode}</b></>}
            </span>
          </Link>
          <button type="button" className="ready-ping__close" onClick={() => hide(o.orderId)} aria-label={`Close the ready message for ${o.stallName}`}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
