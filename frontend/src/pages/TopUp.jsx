import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createTopUp, getTopUp } from "../api.js";
import { KidSwitcher, PageHeader, ParentTabs, money, useKids } from "../components/ParentShell.jsx";
import lockIcon from "../assets/figma/lock.svg";
import clockIcon from "../assets/figma/clock.svg";
import downloadIcon from "../assets/figma/download.svg";
import successIcon from "../assets/figma/success.svg";

const AMOUNTS = [10, 20, 50];
const POLL_MS = 3000;

// Parent tops up a kid's wallet: pick amount -> scan NETS QR in a sheet -> paid or expired
export default function TopUp() {
  const { kids, kid, select, error: loadError, reload, token } = useKids();
  const [amount, setAmount] = useState(20);
  const [other, setOther] = useState(null); // string while "Other" is picked
  const [topUp, setTopUp] = useState(null); // { topUpId, amount, qrCode, status, walletBefore }
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sheet = useRef(null);

  const value = other === null ? amount : Number(other);
  const validAmount = value >= 1 && value <= 200 && /^\d+(\.\d{1,2})?$/.test(String(value));
  const pending = topUp?.status === "pending";

  async function makeQr() {
    if (!validAmount) return setError("Amount must be S$1 to S$200.");
    setError("");
    setBusy(true);
    try {
      const t = await createTopUp(token, kid.id, value);
      setTopUp({ ...t, walletBefore: kid.walletBalance, kidName: kid.name, paidAt: null });
      setSecondsLeft(t.expiresInSeconds);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  useEffect(() => {
    if (pending) sheet.current?.showModal();
    else sheet.current?.close();
  }, [pending]);

  // ask the server every few seconds whether NETS says it's paid
  useEffect(() => {
    if (!pending) return;
    const poll = setInterval(() => {
      getTopUp(token, topUp.topUpId)
        .then((t) => {
          if (t.status === "pending") return;
          setTopUp((cur) => ({ ...cur, status: t.status, paidAt: new Date() }));
          reload();
        })
        .catch(() => {}); // a missed check is fine, the next one retries
    }, POLL_MS);
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [pending]);

  const backTo = kid ? `/parent/home?kid=${kid.id}` : "/parent/home";

  if (topUp?.status === "success")
    return (
      <main className="screen parent with-tabs">
        <section className="done" role="status">
          <img src={successIcon} alt="" width="88" height="88" />
          <h1>{money(topUp.amount)} added</h1>
          <p className="lead">{topUp.kidName}'s wallet is now {money(topUp.walletBefore + topUp.amount)}</p>
          <dl className="card facts">
            <div><dt>Paid with</dt><dd>NETS QR</dd></div>
            <div><dt>Reference</dt><dd>KE-{topUp.topUpId}</dd></div>
            <div><dt>Time</dt><dd>Today, {topUp.paidAt.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" })}</dd></div>
          </dl>
          <Link to={backTo} className="btn btn--primary">Back to Home</Link>
        </section>
        <ParentTabs active="home" kidId={kid?.id} />
      </main>
    );

  if (topUp?.status === "failed")
    return (
      <main className="screen parent with-tabs">
        <section className="done" role="status">
          <h1>QR code expired</h1>
          <p className="lead">Nothing was charged. Make a new QR code to try again.</p>
          <button className="btn btn--primary" onClick={() => setTopUp(null)}>Try again</button>
          <Link to={backTo} className="btn btn--text">Back to Home</Link>
        </section>
        <ParentTabs active="home" kidId={kid?.id} />
      </main>
    );

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <main className="screen parent with-tabs">
      <PageHeader title="Top up wallet" subtitle="Money goes into your child’s KiddyEats wallet" backTo={backTo} />
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {!kids && !loadError && <p className="lead">Loading…</p>}

      {kid && (
        <div className="topup">
          <KidSwitcher kids={kids} kid={kid} onSelect={(id) => { select(id); setError(""); }} />
          <div className="card">
            <p className="card__label">In {kid.name}’s wallet now</p>
            <p className="card__amount">{money(kid.walletBalance)}</p>
          </div>

          <h2>How much?</h2>
          <div className="presets presets--fill" role="group" aria-label="Amount">
            {AMOUNTS.map((a) => (
              <button key={a} type="button" className="preset" aria-pressed={other === null && amount === a}
                onClick={() => { setAmount(a); setOther(null); setError(""); }}>S${a}</button>
            ))}
            <button type="button" className="preset" aria-pressed={other !== null} onClick={() => setOther(other ?? "")}>Other</button>
          </div>
          {other !== null && (
            <div className="field">
              <label htmlFor="other">Amount (S$1 to S$200)</label>
              <div className="input">
                <span className="input__prefix">S$</span>
                <input id="other" inputMode="decimal" autoFocus placeholder="e.g. 15" value={other}
                  onChange={(e) => setOther(e.target.value.replace(/[^\d.]/g, ""))} />
              </div>
            </div>
          )}

          {validAmount && (
            <div className="card card--mint">
              <p className="card__label">{kid.name}’s wallet after</p>
              <p className="card__amount card__amount--green">{money(kid.walletBalance + value)}</p>
              <p className="card__label">Daily limit stays {money(kid.dailyLimit)}</p>
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn--primary" onClick={makeQr} disabled={busy}>
            {busy ? "Making QR code… (can take a minute)" : validAmount ? `Pay ${money(value)} with NETS QR` : "Pay with NETS QR"}
          </button>
          <p className="note"><img src={lockIcon} alt="" width="16" height="16" />Next, scan the NETS QR with your banking app</p>
        </div>
      )}

      <dialog ref={sheet} className="sheet" aria-labelledby="sheet-title" onCancel={(e) => { e.preventDefault(); setTopUp(null); }}>
        {pending && (
          <>
            <span className="sheet__grabber" aria-hidden="true" />
            <span className="sheet__label">NETS QR</span>
            <h2 id="sheet-title">Scan to pay {money(topUp.amount)}</h2>
            <p className="lead">Top up for {topUp.kidName} · to KiddyEats</p>
            <div className="sheet__qr"><img src={topUp.qrCode} alt={`NETS QR code to pay ${money(topUp.amount)}`} width="203" height="203" /></div>
            <p className="sheet__expiry"><img src={clockIcon} alt="" width="16" height="16" />
              {secondsLeft > 0 ? `Code expires in ${mm}:${ss}` : "Checking…"}
            </p>
            <p className="sheet__help">Open any banking app that takes NETS QR and scan this code. On this phone? Save it, then upload it in your banking app.</p>
            <a className="btn btn--outline" href={topUp.qrCode} download={`kiddyeats-topup-${topUp.topUpId}.png`}>
              <img src={downloadIcon} alt="" width="18" height="18" />Save QR to Photos
            </a>
            <button className="btn btn--text" onClick={() => setTopUp(null)}>Cancel</button>
          </>
        )}
      </dialog>

      <ParentTabs active="home" kidId={kid?.id} />
    </main>
  );
}
