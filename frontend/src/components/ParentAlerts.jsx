import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getParentAlerts } from "../api.js";

// alerts card on parent home, checks every 30s like the kid's ready ping
// low_wallet is left out, the wallet box under it already shows that
const POLL_MS = 30000;
const ICON = { near_limit: "⚠️", limit_reached: "⛔", pin_locked: "🔒" };

export default function ParentAlerts({ token, onLowWallets }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const check = () =>
      getParentAlerts(token)
        .then((d) => {
          setAlerts(d.alerts.filter((a) => a.type !== "low_wallet"));
          if (onLowWallets) onLowWallets(d.alerts.filter((a) => a.type === "low_wallet")); // wallet box on parent home uses these
        })
        .catch(() => {}); // try again next time
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [token]);

  if (alerts.length === 0) return null;
  return (
    <section className="p-alerts" role="status" aria-label="Alerts">
      {alerts.map((a) => (
        <div key={`${a.childId}-${a.type}`} className={`p-alert p-alert--${a.type}`}>
          <span aria-hidden="true">{ICON[a.type]}</span>
          <p>{a.message}</p>
          {a.type === "pin_locked" && <Link to={`/parent/pin?kid=${a.childId}`} className="edit-link">Reset</Link>}
        </div>
      ))}
    </section>
  );
}
