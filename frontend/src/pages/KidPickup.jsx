import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOrderQueue } from "../api.js";
import { getSession } from "../session.js";
import BackButton from "../components/BackButton.jsx";
import { StageSteps, timeLeft, useNow } from "../components/OrderStatus.jsx";
import "./kidMenu.css";

const POLL_MS = 10000;

// kid's order: place in the queue, then the pickup code to show the stall
export default function KidPickup() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState("");
  const now = useNow();

  useEffect(() => {
    const { token } = getSession();
    const load = () => getOrderQueue(token, orderId).then((o) => { setOrder(o); setErr(""); }).catch((e) => setErr(e.message));
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [orderId]);

  return (
    <main className="screen kid km-screen pickup">
      <header className="pickup__head">
        <BackButton to="/kid/home" />
        <h1 className="km-h2">My order</h1>
      </header>
      {err && <p className="km-lead" role="alert">{err}</p>}
      {!order && !err && <p className="km-lead">Loading…</p>}
      {order && order.stage !== "cancelled" && <StageSteps stage={order.stage} />}

      {order && order.stage === "ready" && (
        <section className="pickup__card" aria-live="polite">
          <p className="pickup__title">Your food is ready! 🎉</p>
          <p>Go to <strong>{order.stallName}</strong> and show this code</p>
          <p className="pickup__label">Pickup code</p>
          <p className="pickup__code">{order.pickupCode}</p>
          <p className="pickup__small">Order number {order.queueNumber}</p>
        </section>
      )}

      {order && (order.stage === "received" || order.stage === "cooking") && (
        <section className="pickup__card">
          <p className="pickup__title">{order.stage === "received" ? "Order received! 📝" : "Cooking… 🍳"}</p>
          <p>{order.stallName}, order number {order.queueNumber}</p>
          <p className="pickup__label">Time left</p>
          <p className="pickup__code">{timeLeft(order.readyBy, now) || "Almost ready"}</p>
          <p className="pickup__label">
            {order.ahead > 0 ? `${order.ahead} ${order.ahead === 1 ? "order" : "orders"} before yours` : "You're next!"}
          </p>
          <p className="pickup__small">We'll ping you when it's ready!</p>
        </section>
      )}

      {order && order.stage === "collected" && (
        <section className="pickup__card">
          <p className="pickup__title">All done! 😋</p>
          <p>You already collected this order.</p>
          <Link to="/kid/home" className="km-big km-big--sun">Back home</Link>
        </section>
      )}
    </main>
  );
}
