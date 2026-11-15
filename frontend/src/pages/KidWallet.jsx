import { useEffect, useState } from "react";
import { getHome } from "../api.js";
import { getSession } from "../session.js";
import KidTabs from "../components/KidTabs.jsx";
import KidAvatarMenu from "../components/KidAvatarMenu.jsx";

// Kid Wallet tab: what's in the wallet and what's left to spend today
export default function KidWallet() {
  const { token } = getSession();
  const [home, setHome] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getHome(token).then(setHome).catch((err) => setError(err.message));
  }, [token]);

  return (
    <main className="screen kid home-kid">
      <div className="blob blob--sun" aria-hidden="true" />
      <header className="hk-header">
        {home && <KidAvatarMenu name={home.child.name} emoji={home.child.avatarEmoji} />}
        <div>
          <h1>My wallet</h1>
          <p className="hk-sub">Mum or Dad tops it up</p>
        </div>
      </header>

      {error && <p role="alert">{error}</p>}
      {!home && !error && <p>Loading…</p>}
      {home && (
        <section className="hk-money">
          <p className="hk-money__title">In my wallet</p>
          <p className="hk-money__left">${home.money.wallet.toFixed(2)}</p>
          <p className="hk-money__note">
            I can spend ${home.money.left.toFixed(2)} more today · Daily limit ${home.money.dailyLimit.toFixed(2)}
          </p>
        </section>
      )}

      <KidTabs active="wallet" />
    </main>
  );
}
