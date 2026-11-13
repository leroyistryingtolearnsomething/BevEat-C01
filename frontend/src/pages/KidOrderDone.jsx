import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { getOrderQueue } from "../api.js";
import { getSession } from "../session.js";
import { timeLeft, useNow } from "../components/OrderStatus.jsx";
import baoCheer from "../assets/figma/kid/order-bao.svg";
import clockIcon from "../assets/figma/clock.svg";
import "./kidMenu.css";

const sgd = (n) => `S$${Number(n).toFixed(2)}`;
const CONFETTI = ["#ff6b5b", "#5bc0eb", "#2ec4a0", "#ff9ec4", "#715bff", "#ffffff"];

// Kids Figma "08 Yay! Order sent". Shown right after the wallet payment. It reads the checkout reply that Tray
// passes along, so a refresh (which loses it) simply goes Home: the order is safe on the server either way.
export default function KidOrderDone() {
  const { state } = useLocation();
  const done = state?.done;
  const [wait, setWait] = useState(null); // { readyBy, waitMinutes } of the slowest stall, from the queue endpoint
  const now = useNow();

  useEffect(() => {
    if (!done?.orders?.length) return;
    const { token } = getSession();
    let current = true;
    Promise.all(done.orders.map((o) => getOrderQueue(token, o.orderId).catch(() => null))).then((qs) => {
      // countdown to the order that will be ready last
      const known = qs.filter((q) => q && q.readyBy).sort((a, b) => new Date(b.readyBy) - new Date(a.readyBy));
      if (current && known.length) setWait(known[0]);
    });
    return () => { current = false; };
  }, [done]);

  if (!done?.orders?.length) return <Navigate to="/kid/home" replace />;

  const { orders, total, walletBalance } = done;
  const many = orders.length > 1;
  const first = orders[0];
  const left = wait && timeLeft(wait.readyBy, now);
  // bar fills up as the countdown goes down
  const msLeft = wait ? Math.max(0, new Date(wait.readyBy).getTime() - now) : 0;
  const filled = wait ? Math.min(100, Math.max(5, 100 - (msLeft / (wait.waitMinutes * 60000)) * 100)) : 5;

  return (
    <main className="screen kid km-screen od">
      <div className="od-confetti" aria-hidden="true">
        {CONFETTI.concat(CONFETTI, CONFETTI.slice(0, 2)).map((color, i) => <i key={i} style={{ "--i": i, background: color }} />)}
      </div>

      <img className="od-bao" src={baoCheer} width="182" height="182" alt="" />
      <h1 className="od-title" aria-live="polite">Yay! Order sent!</h1>
      <p className="od-sub">{many ? "Your food is" : `${first.stallName} is`} cooking {many ? "" : "your food "}right now.</p>

      <div className="od-pills">
        {orders.map((o) => (
          <Link key={o.orderId} to={`/kid/pickup/${o.orderId}`} className="od-pill">
            <span>{many ? o.stallName : "Order number"}</span>
            <b>#{o.queueNumber}</b>
          </Link>
        ))}
      </div>
      <p className="od-paid">You paid {sgd(total)} · Wallet left {sgd(walletBalance)}</p>

      <section className="od-status" aria-label="Order status">
        <div className="od-status__row">
          <span className="od-status__icon"><img src={clockIcon} width="20" height="20" alt="" /></span>
          <div>
            <p className="od-status__title">{!wait ? "We'll ping you when it's ready" : left ? `Ready in about ${left}` : "Almost ready!"}</p>
            <p className="od-status__sub">A green banner pops up when it's ready.</p>
          </div>
        </div>
        <div className="od-progress" aria-hidden="true"><i style={{ width: `${filled}%` }} /></div>
      </section>

      <div className="od-actions">
        <Link to="/kid/snap" className="km-big km-big--tomato">Snap my food for hearts</Link>
        <Link to="/kid/home" className="km-big km-big--white">Back home</Link>
      </div>
    </main>
  );
}
