import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getStallMenu, getStallWait } from "../api.js";
import { getSession } from "../session.js";
import { recall, remember } from "../memo.js";
import { loadTray, trayCount, trayCents, formatSgd, moneyLeftCents, toCents } from "../tray.js";
import BackCircle from "../components/menu/BackCircle.jsx";
import DishCard from "../components/menu/DishCard.jsx";
import blobMenu from "../assets/figma/menu/blob-menu.svg";
import heart18 from "../assets/figma/menu/heart-18.svg";
import "./kidMenu.css";

// The chip the page opens on. PRODUCT.md: allergy dishes never appear in the default "Safe for me".
const DEFAULT_VIEW = "safe";
const CHIPS = [
  { view: "safe", label: "Safe for me", tone: "mint" },
  { view: "all", label: "Everything", tone: "sky" },
];

// Kids Figma 03: one stall's menu. Which dishes are locked is decided by the server
// (GET /api/stalls/:stallId/menu); this page only draws what it gets back.
export default function StallMenu() {
  const { stallId } = useParams();
  const { token } = getSession();
  const [view, setView] = useState(DEFAULT_VIEW);
  const [menu, setMenu] = useState(() => recall(`${token}:menu:${stallId}:${DEFAULT_VIEW}`)); // last menu that loaded, kept while a chip reloads (and from the last visit)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [waitMinutes, setWaitMinutes] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true; // ignore an answer that arrives after the kid switched chips again
    setLoading(true);
    setError("");
    getStallMenu(token, stallId, view)
      .then((data) => { remember(`${token}:menu:${stallId}:${view}`, data); if (current) setMenu(data); })
      .catch((err) => current && setError(err.message))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [token, stallId, view, retry]);

  // Xin Sheng's live queue: "~5 min wait". If it fails, the header just leaves the wait out.
  useEffect(() => {
    getStallWait(token, stallId)
      .then((data) => setWaitMinutes(data.waitMinutes))
      .catch(() => setWaitMinutes(null));
  }, [token, stallId]);

  if (error && !menu) {
    return (
      <main className="screen kid km-screen km-screen--center">
        <BackCircle to="/kid/home" />
        <p className="km-lead" role="alert">{error}</p>
        <button type="button" className="km-big km-big--white" onClick={() => setRetry((n) => n + 1)}>Try again</button>
      </main>
    );
  }
  if (!menu) {
    return (
      <main className="screen kid km-screen km-screen--center" aria-busy="true">
        <p className="km-lead">Getting the menu…</p>
      </main>
    );
  }

  const { stall, counts } = menu;
  const tray = loadTray(token);
  // The server's overBudget only knows today's money, not this browser's tray, so a dish is also
  // "Not enough money today" when it costs more than what's left after the tray.
  // (06 My tray's POST /api/tray/quote re-checks the real total on the server.)
  const leftCents = moneyLeftCents(menu.money.canSpend, tray);
  const dishes = menu.dishes.map((d) =>
    d.status === "allowed" && !d.overBudget && toCents(d.price) > leftCents ? { ...d, overBudget: true } : d
  );
  const sub = [stall.unitNo, stall.isOpen ? "Open now" : "Closed now"];
  if (stall.isOpen && waitMinutes !== null) sub.push(`~${waitMinutes} min wait`);

  return (
    <main className="screen kid km-screen" aria-busy={loading}>
      <img className="blob km-blob km-blob--menu" src={blobMenu} width="180" height="180" alt="" aria-hidden="true" />

      <header className="km-row km-head">
        <BackCircle to="/kid/home" />
        <div className="km-head__text">
          <h1 className="km-head__title">{stall.name}</h1>
          <p className="km-head__sub">{sub.join(" · ")}</p>
        </div>
      </header>

      <p className="km-banner">
        <span className="km-banner__icon"><img src={heart18} width="18" height="18" alt="" /></span>
        Pics are snapped by kids like you! The pic with the most hearts shows here.
      </p>

      <div className="km-chips" role="group" aria-label="Which food to show">
        {CHIPS.map((c) => (
          <button
            key={c.view}
            type="button"
            className={`km-chip km-chip--${c.tone}${view === c.view ? " km-chip--on" : ""}`}
            aria-pressed={view === c.view}
            onClick={() => setView(c.view)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <p className="km-muted" role="alert">{error}</p>}

      {dishes.length > 0 ? (
        <div className="km-grid">
          {dishes.map((d) => <DishCard key={d.id} dish={d} />)}
        </div>
      ) : counts.total === 0 ? (
        <p className="km-empty">This stall has no food right now. Try another stall!</p>
      ) : (
        <div className="km-empty">
          <p>No safe picks for you here today.</p>
          <button type="button" className="km-chip km-chip--sky" onClick={() => setView("all")}>See why in “Everything”</button>
        </div>
      )}

      {trayCount(tray) > 0 && (
        <footer className="km-footer">
          {/* The total here is only a guide: 06 My tray asks the server for the real price */}
          <Link to="/kid/tray" className="km-big km-big--sun">
            My tray  ·  {trayCount(tray)} {trayCount(tray) === 1 ? "item" : "items"}  ·  {formatSgd(trayCents(tray))}
          </Link>
        </footer>
      )}
    </main>
  );
}
