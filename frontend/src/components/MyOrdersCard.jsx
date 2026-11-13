import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyOrders } from "../api.js";
import { getSession } from "../session.js";
import { statusLine, useNow } from "./OrderStatus.jsx";

// kid home: today's orders with place in the queue, tap one to open the pickup page
const POLL_MS = 10000;

export default function MyOrdersCard() {
  const [orders, setOrders] = useState([]);
  const now = useNow();

  useEffect(() => {
    const { token } = getSession();
    const load = () => getMyOrders(token).then((d) => setOrders(d.orders)).catch(() => {}); // try again next time
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  if (orders.length === 0) return null;

  return (
    <section className="my-orders">
      <h2>My orders</h2>
      {orders.map((o) => (
        <Link key={o.orderId} to={`/kid/pickup/${o.orderId}`} className={`my-orders__row${o.ready ? " my-orders__row--ready" : ""}`}>
          <span className="my-orders__num">#{o.queueNumber}</span>
          <span className="my-orders__text">
            <strong>{o.stallName}</strong>
            <small>{statusLine(o, now)}</small>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      ))}
    </section>
  );
}
