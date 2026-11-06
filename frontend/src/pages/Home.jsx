import { useEffect, useState } from "react";
import { getHome } from "../api.js";
import { getSession } from "../session.js";
import { Link, useNavigate } from "react-router-dom";
import { clearSession } from "../session.js";
import Bao from "../components/Bao.jsx";
// Kid Home page: shows the data from GET /api/home
export default function Home() {
  const { token } = getSession();             // the logged-in kid's token
  const [home, setHome] = useState(null);     // the data, null until it arrives
  const [error, setError] = useState("");  
  
    const navigate = useNavigate();
  const logOut = () => {
    clearSession();                       // forget the token
    navigate("/", { replace: true });     // back to the welcome screen
  };// an error message, if it fails

  // runs once when the page opens: ask the backend for the data
  useEffect(() => {
    getHome(token)
      .then((data) => setHome(data))          // success: save the data, page redraws
      .catch((err) => setError(err.message)); // failure: save the error, page redraws
  }, []);

  if (error) return <main className="screen kid"><p>{error}</p></main>;
  if (!home) return <main className="screen kid"><p>Loading…</p></main>;

  const { child, money, rules, pics, stalls } = home;   // pull the two parts out of the data, to save typing

  return (
    <main className="screen kid home-kid">
            <div className="blob blob--sun" aria-hidden="true" />
      {/* Header: avatar, greeting */}
      <header className="hk-header">
        <span className="hk-avatar">{child.avatarEmoji}</span>
        <div>
          <h1>Hi {child.name}!</h1>
          <p className="hk-sub">What's for lunch?</p>
        </div>
      </header>

      {/* Money card: what's left today, and the meter */}
      <section className="hk-money">
        <p className="hk-money__title">My food money today</p>
        <p className="hk-money__left">
          S${money.left.toFixed(2)} <span>left</span>
        </p>
        <div className="hk-meter">
          <div className="hk-meter__fill" style={{ width: `${(money.left / money.dailyLimit) * 100}%` }} />
        </div>
        <p className="hk-money__note">
          Spent S${money.spentToday.toFixed(2)} · Daily limit S${money.dailyLimit.toFixed(2)}
        </p>
      </section>
            {/* Mum's rules: one chip per allergy */}
      <section className="hk-rules">
        <h2>Mum's rules for me</h2>
        {rules.length === 0 ? (
          <p className="hk-sub">No food rules. Enjoy!</p>
        ) : (
          <div className="hk-chips">
            {rules.map((r) => (
              <span key={r.label} className={`hk-chip hk-chip--${r.type}`}>
                {r.icon} No {r.label}
              </span>
            ))}
          </div>
        )}
      </section>
            {/* Today's yummiest pics: one card per dish, its most-voted photo */}
      <section className="hk-pics">
        <div className="hk-row-head">
          <h2>Today's yummiest pics</h2>
          <span className="hk-link">See all</span>
        </div>
        <div className="hk-pics__row">
          {pics.map((p) => (
            <article key={p.photo} className={`hk-pic hk-pic--${p.status}`}>
              <img src={p.imageUrl} alt={p.dish} className="hk-pic__img" />
              <h3>{p.dish}</h3>
              <div className="hk-pic__meta">
                <span className="hk-price">S${p.price.toFixed(2)}</span>
                <span className="hk-likes">❤️ {p.likes}</span>
              </div>
              {p.status === "allergy" && <span className="hk-note">Not for you</span>}
            </article>
          ))}
        </div>
      </section>
            {/* Stalls near you: how many dishes this kid can safely eat at each */}
      <section className="hk-stalls">
        <div className="hk-row-head">
          <h2>Stalls near you</h2>
          <span className="hk-link">📍 Map</span>
        </div>
        {stalls.map((s) => (
          <article key={s.stall} className="hk-stall">
            {s.image ? (
              <img src={s.image} alt="" className="hk-stall__img" />
            ) : (
              <div className="hk-stall__img hk-stall__img--empty">🍽️</div>
            )}
            <div className="hk-stall__text">
              <h3>{s.name}</h3>
              <p className="hk-sub">{s.unit}</p>
              <p className={s.safePicks > 0 ? "hk-safe" : "hk-safe hk-safe--none"}>
                {s.safePicks === 0
                  ? "No safe picks for you"
                  : `✓ ${s.safePicks} safe ${s.safePicks === 1 ? "pick" : "picks"} for you`}
              </p>
            </div>
          </article>
        ))}
      </section>
            {/* Tab bar: Home is the page we're on; the others link to pages that don't exist yet */}
      <nav className="hk-tabbar" aria-label="Main">
        <Link to="/kid/home" className="hk-tab hk-tab--active" aria-current="page">
          <span className="hk-tab__icon">🏠</span>Home
        </Link>
        <button className="hk-tab">
          <span className="hk-tab__icon"><Bao size={30} /></span>Ask Bao
        </button>
        <button className="hk-tab hk-tab--snap">
          <span className="hk-tab__icon">📷</span>Snap
        </button>
        <button className="hk-tab hk-tab--locked" disabled aria-label="Stars, coming soon" title="Coming soon">
          <span className="hk-tab__icon">⭐</span>
          <span className="hk-tab__lock" aria-hidden="true">🔒</span>
          <span className="hk-tab__label">Stars</span>
        </button>
        <button className="hk-tab" onClick={logOut}>
          <span className="hk-tab__icon">👛</span>Log out
        </button>
      </nav>
    </main>
  );
};