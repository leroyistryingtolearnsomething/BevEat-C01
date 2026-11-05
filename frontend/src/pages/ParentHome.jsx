import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listChildren } from "../api.js";
import { clearSession, getSession } from "../session.js";
import Icon from "../components/Icon.jsx";

export const money = (n) => `S$${n.toFixed(2)}`;

// Parent home: each kid's wallet, with a Top up button
export default function ParentHome() {
  const navigate = useNavigate();
  const { token, name } = getSession();
  const [kids, setKids] = useState(null);
  const [error, setError] = useState("");

  const logOut = () => {
    clearSession();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    listChildren(token)
      .then((d) => setKids(d.children))
      .catch((err) => (err.status === 401 ? logOut() : setError(err.message)));
  }, []);

  return (
    <main className="screen parent">
      <h1>Hi {name}!</h1>
      <p className="lead">Your kids' wallets</p>

      <div className="stack">
        {error && <p className="form-error" role="alert">{error}</p>}
        {!kids && !error && <p className="lead">Loading…</p>}
        {kids?.length === 0 && <p className="lead">No kids added yet.</p>}
        {kids?.map((k) => (
          <section key={k.id} className="kid-card">
            <span className="kid-card__avatar" aria-hidden="true">{k.avatarEmoji || "🙂"}</span>
            <div className="kid-card__text">
              <h2>{k.name}</h2>
              <p>Wallet <strong>{money(k.walletBalance)}</strong> · {money(k.dailyLimit)} a day</p>
            </div>
            <Link to={`/parent/top-up/${k.id}`} state={{ kid: k }}
              className="btn btn--primary kid-card__btn" aria-label={`Top up ${k.name}'s wallet`}>
              Top up
            </Link>
          </section>
        ))}
        <Link to="/parent/add-child" className="btn btn--secondary">
          <Icon name="plus" size={20} /> Add a child
        </Link>
      </div>

      <button className="btn btn--text logout" onClick={logOut}>Log out</button>
    </main>
  );
}
