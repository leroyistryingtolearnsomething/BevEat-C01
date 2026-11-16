import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOrderQueue, markOrderReceived } from "../api.js";
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
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const { token } = getSession();

  const load = () => getOrderQueue(token, orderId).then((o) => { setOrder(o); setErr(""); }).catch((e) => setErr(e.message));

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [orderId]);

  // countdown just ended: check now instead of waiting for the next poll
  const left = order && timeLeft(order.readyBy, now);
  useEffect(() => {
    if (order && order.readyBy && !left) load();
  }, [!!left]);

  // kid has the food, order is done
  async function received() {
    setBusy(true);
    try {
      await markOrderReceived(token, orderId);
      await load();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <main className="screen kid km-screen pickup">
      <header className="pickup__head">
        <BackButton to="/kid/home" />
        <h1 className="km-h2">My order</h1>
      </header>
      {err && <p className="km-lead" role="alert">{err}</p>}
      {!order && !err && (
        // grey boxes while the order loads, instead of just "Loading…"
        <section className="pickup__card" aria-busy="true" aria-label="Loading your order">
          <span className="skel skel--title" />
          <span className="skel skel--line" />
          <span className="skel skel--big" />
          <span className="skel skel--line" />
        </section>
      )}
      {order && order.stage !== "cancelled" && <StageSteps stage={order.stage} />}

      {order && order.stage === "ready" && (
        <section className="pickup__card" aria-live="polite">
          <p className="pickup__title">Your food is ready! 🎉</p>
          <p>Go to <strong>{order.stallName}</strong> and show this code</p>
          <p className="pickup__label">Pickup code</p>
          {/* one box per number so the stall uncle can read it easily */}
          <p className="pickup__tiles" aria-label={`Pickup code ${order.pickupCode}`}>
            {String(order.pickupCode).split("").map((c, i) => (
              <span key={i} aria-hidden="true">{c}</span>
            ))}
          </p>
          <p className="pickup__small">Order number {order.queueNumber}</p>
          <button type="button" className="km-big km-big--sun" onClick={received} disabled={busy}>
            {busy ? "Saving…" : "Order received"}
          </button>
          <p className="pickup__small">Tap this once you have your food</p>
        </section>
      )}

      {order && (order.stage === "received" || order.stage === "cooking") && (
        <section className="pickup__card">
          <p className="pickup__title">{order.stage === "received" ? "Order placed! 📝" : "Cooking… 🍳"}</p>
          <p>{order.stallName}, order number {order.queueNumber}</p>
          <p className="pickup__label">Time left</p>
          <p className="pickup__code">{left || "Almost ready"}</p>
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
