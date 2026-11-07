import { useEffect, useState } from "react";
import { getAllPics } from "../api.js";
import { getSession } from "../session.js";
import KidTabs from "../components/KidTabs.jsx";
import BackCircle from "../components/menu/BackCircle.jsx";
import DishCard from "../components/menu/DishCard.jsx";
import heart18 from "../assets/figma/menu/heart-18.svg";
import "./kidMenu.css";

// "See all" from Home: every dish's most-hearted pic today, in the stall menu's 2-column grid
export default function KidPics() {
  const { token } = getSession();
  const [pics, setPics] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setError("");
    getAllPics(token).then((d) => setPics(d.pics)).catch((err) => setError(err.message));
  }, [token, retry]);

  return (
    <main className="screen kid home-kid" aria-busy={!pics && !error}>
      <header className="km-row km-head">
        <BackCircle to="/kid/home" back />
        <div className="km-head__text">
          <h1 className="km-head__title">Today's yummiest pics</h1>
          <p className="km-head__sub">Most hearts first</p>
        </div>
      </header>

      <p className="km-banner">
        <span className="km-banner__icon"><img src={heart18} width="18" height="18" alt="" /></span>
        Pics are snapped by kids like you! Tap one to see the food.
      </p>

      {error && (
        <div className="km-empty">
          <p role="alert">{error}</p>
          <button type="button" className="km-big km-big--white" onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      )}
      {!pics && !error && <p className="km-lead">Getting the pics…</p>}
      {pics && pics.length === 0 && <p className="km-empty">No pics yet today. Snap your lunch to be the first!</p>}
      {pics && pics.length > 0 && (
        <div className="km-grid">
          {pics.map((d) => <DishCard key={d.id} dish={d} />)}
        </div>
      )}

      <KidTabs active="home" />
    </main>
  );
}
