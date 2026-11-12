import { useEffect, useState } from "react";
import { getKidsOrders } from "../api.js";

// parent home: kids' orders today that aren't picked up yet, same info the kid sees
const POLL_MS = 15000;

export default function ParentOrdersCard({ token }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const load = () => getKidsOrders(token).then((d) => setOrders(d.orders)).catch(() => {}); // try again next time
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [token]);

  if (orders.length === 0) return null;

  return (
    <section className="p-orders" aria-label="Orders today">
      {orders.map((o) => (
        <div key={o.orderId} className={`p-order${o.ready ? " p-order--ready" : ""}`}>
          <span aria-hidden="true">{o.ready ? "🔔" : "🍳"}</span>
          <p>
            <strong>{o.childName}'s order #{o.queueNumber}</strong> at {o.stallName}
            <br />
            {o.ready
              ? `Ready to collect, pickup code ${o.pickupCode}`
              : `Cooking, ${o.ahead} before it, about ${o.waitMinutes} min`}
          </p>
        </div>
      ))}
    </section>
  );
}
