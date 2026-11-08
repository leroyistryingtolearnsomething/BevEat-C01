import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getReadyOrders } from "../api.js";
import { getSession } from "../session.js";

// order ready ping: kid app checks every 10s, shows a banner when food is ready
const POLL_MS = 10000;

export default function ReadyPing() {
  const [ready, setReady] = useState([]);
  const seen = useRef(new Set());
  const { pathname } = useLocation();

  useEffect(() => {
    async function check() {
      const s = getSession();
      if (!s || s.role !== "child") return setReady([]);
      try {
        const { orders } = await getReadyOrders(s.token);
        const isNew = orders.some((o) => !seen.current.has(o.orderId));
        orders.forEach((o) => seen.current.add(o.orderId));
        if (isNew && navigator.vibrate) navigator.vibrate([200, 100, 200]);
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

  // no banner on the pickup page, it already shows the code
  if (ready.length === 0 || pathname.startsWith("/kid/pickup")) return null;
  // bottom 104 so it sits above the kid tab bar
  return (
    <div className="ready-ping" role="alert" style={{
      position: "fixed", left: 16, right: 16, bottom: 104, zIndex: 50, padding: "14px 16px",
      borderRadius: 16, background: "#2e7d32", color: "#fff", fontWeight: 700,
      boxShadow: "0 6px 20px rgba(0,0,0,.2)",
    }}>
      {ready.map((o) => (
        <Link key={o.orderId} to={`/kid/pickup/${o.orderId}`} style={{ display: "block", margin: 0, color: "#fff" }}>
          🔔 Your food is ready! Go to {o.stallName}, number {o.queueNumber}
          {o.pickupCode && <> · show code <span style={{ fontSize: 20, letterSpacing: 2 }}>{o.pickupCode}</span></>}
          {" "}›
        </Link>
      ))}
    </div>
  );
}
