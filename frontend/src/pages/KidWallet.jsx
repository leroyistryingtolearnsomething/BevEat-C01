import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getHome } from "../api.js";
import { clearSession, getSession } from "../session.js";
import KidTabs from "../components/KidTabs.jsx";

// Kid Wallet tab: what's in the wallet, and log out (asks first, so a stray tap doesn't log the kid out)
export default function KidWallet() {
  const navigate = useNavigate();
  const { token } = getSession();
  const [home, setHome] = useState(null);
  const [error, setError] = useState("");
  const confirm = useRef(null);

  useEffect(() => {
    getHome(token).then(setHome).catch((err) => setError(err.message));
  }, [token]);

  const logOut = () => {
    clearSession();
    navigate("/", { replace: true });
  };

  return (
    <main className="screen kid home-kid">
      <div className="blob blob--sun" aria-hidden="true" />
      <header className="hk-header">
        {home && <span className="hk-avatar">{home.child.avatarEmoji}</span>}
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
          <p className="hk-money__left">S${home.money.wallet.toFixed(2)}</p>
          <p className="hk-money__note">
            I can spend S${home.money.left.toFixed(2)} more today · Daily limit S${home.money.dailyLimit.toFixed(2)}
          </p>
        </section>
      )}

      <button className="btn btn--kid kw-logout" onClick={() => confirm.current.showModal()}>Log out</button>

      <dialog ref={confirm} className="confirm kw-confirm" aria-labelledby="kw-confirm-title">
        <h2 id="kw-confirm-title">Log out of KiddyEats?</h2>
        <p>You'll need your login name and PIN to come back in.</p>
        <button className="btn btn--kid" autoFocus onClick={() => confirm.current.close()}>Stay logged in</button>
        <button className="btn kw-confirm__out" onClick={logOut}>Log out</button>
      </dialog>

      <KidTabs active="wallet" />
    </main>
  );
}
