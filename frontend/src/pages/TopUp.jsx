import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createTopUp, getTopUp, listChildren } from "../api.js";
import { clearSession, getSession } from "../session.js";
import { money } from "./ParentHome.jsx";
import BackButton from "../components/BackButton.jsx";

const AMOUNTS = [5, 10, 20, 50];
const POLL_MS = 3000;

// Parent tops up a kid's wallet: pick amount -> scan NETS QR -> paid or expired
export default function TopUp() {
  const navigate = useNavigate();
  const { childId } = useParams();
  const { token } = getSession();
  const [kid, setKid] = useState(useLocation().state?.kid);
  const [amount, setAmount] = useState(10);
  const [custom, setCustom] = useState("");
  const [topUp, setTopUp] = useState(null); // { topUpId, amount, qrCode, status }
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function makeQr(e) {
    e.preventDefault();
    const value = custom ? Number(custom) : amount;
    if (!(value >= 1 && value <= 200)) return setError("Amount must be S$1 to S$200.");
    setError("");
    setBusy(true);
    try {
      const t = await createTopUp(token, childId, value);
      setTopUp(t);
      setSecondsLeft(t.expiresInSeconds);
    } catch (err) {
      if (err.status === 401) {
        clearSession();
        return navigate("/parent/login", { replace: true });
      }
      setError(err.message);
    }
    setBusy(false);
  }

  // opened by link or reload, so the kid wasn't passed from the home page
  useEffect(() => {
    if (!kid)
      listChildren(token)
        .then((d) => setKid(d.children.find((k) => String(k.id) === childId)))
        .catch(() => {}); // only the name is missing, the top-up still works
  }, []);

  const pending = topUp?.status === "pending";

  // ask the server every few seconds whether NETS says it's paid
  useEffect(() => {
    if (!pending) return;
    const poll = setInterval(() => {
      getTopUp(token, topUp.topUpId)
        .then((t) => t.status !== "pending" && setTopUp((cur) => ({ ...cur, status: t.status })))
        .catch(() => {}); // a missed check is fine, the next one retries
    }, POLL_MS);
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [pending]);

  const whose = kid ? `${kid.name}'s` : "your kid's";

  if (topUp?.status === "success")
    return (
      <main className="screen parent home">
        <span className="topup__emoji" aria-hidden="true">🎉</span>
        <h1>Paid!</h1>
        <p className="lead">{money(topUp.amount)} added to {whose} wallet.</p>
        <button className="btn btn--primary" onClick={() => navigate("/parent/home")}>Back to home</button>
      </main>
    );

  if (topUp?.status === "failed")
    return (
      <main className="screen parent home">
        <h1>QR code expired</h1>
        <p className="lead">Nothing was charged. Make a new QR code to try again.</p>
        <button className="btn btn--primary" onClick={() => setTopUp(null)}>Try again</button>
        <button className="btn btn--text" onClick={() => navigate("/parent/home")}>Back to home</button>
      </main>
    );

  if (pending) {
    const mm = Math.floor(secondsLeft / 60);
    const ss = String(secondsLeft % 60).padStart(2, "0");
    return (
      <main className="screen parent">
        <BackButton to="/parent/home" />
        <h1>Scan to pay {money(topUp.amount)}</h1>
        <p className="lead">Scan with a banking app that accepts NETS QR.</p>
        <img className="topup__qr" src={topUp.qrCode} alt={`NETS QR code to pay ${money(topUp.amount)}`} />
        <p className="topup__timer">{secondsLeft > 0 ? `Expires in ${mm}:${ss}` : "Checking…"}</p>
        <p className="field__hint topup__wait">Waiting for payment. This page updates by itself.</p>
        <button className="btn btn--text" onClick={() => setTopUp(null)}>Cancel</button>
      </main>
    );
  }

  return (
    <main className="screen parent">
      <BackButton to="/parent/home" />
      <h1>Top up {whose} wallet</h1>
      {kid && <p className="lead">Wallet now {money(kid.walletBalance)}</p>}

      <form className="stack" onSubmit={makeQr} noValidate>
        <fieldset>
          <legend>Amount</legend>
          <div className="chips">
            {AMOUNTS.map((a) => (
              <label key={a} className="chip chip--money">
                <input type="radio" name="amount" checked={!custom && amount === a}
                  onChange={() => { setAmount(a); setCustom(""); }} />
                <span>S${a}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="custom">Or type an amount</label>
          <div className="input">
            <span className="input__prefix">S$</span>
            <input id="custom" inputMode="decimal" placeholder="1 to 200" value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn--primary" disabled={busy}>
          {busy ? "Making QR code… (can take a minute)" : "Pay with NETS QR"}
        </button>
      </form>
    </main>
  );
}
