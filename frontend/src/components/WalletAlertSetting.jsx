import { useEffect, useState } from "react";
import { getWalletAlert, setWalletAlert } from "../api.js";
import { money } from "./ParentShell.jsx";

// parent picks when the "wallet low" alert shows. empty box = one day's limit
export default function WalletAlertSetting({ token, kid }) {
  const [value, setValue] = useState(null); // "15.00" or ""
  const [status, setStatus] = useState({ busy: false, msg: "", err: "" });

  useEffect(() => {
    setValue(null);
    setStatus({ busy: false, msg: "", err: "" });
    getWalletAlert(token, kid.id)
      .then((d) => setValue(d.alertBelow === null ? "" : d.alertBelow.toFixed(2)))
      .catch((e) => setStatus({ busy: false, msg: "", err: e.message }));
  }, [token, kid.id]);

  async function save() {
    let cents = null;
    if (value !== "") {
      cents = Math.round(Number(value) * 100);
      if (!Number.isFinite(cents) || cents < 100 || cents > 10000)
        return setStatus({ busy: false, msg: "", err: "Put $1 to $100, or leave it empty" });
    }
    setStatus({ busy: true, msg: "", err: "" });
    try {
      await setWalletAlert(token, kid.id, cents);
      const when = cents === null ? `under one day's limit (${money(kid.dailyLimit)})` : `under ${money(cents / 100)}`;
      setStatus({ busy: false, msg: `Saved. We'll warn you when ${kid.name}'s wallet is ${when}.`, err: "" });
    } catch (e) {
      setStatus({ busy: false, msg: "", err: e.message });
    }
  }

  return (
    <section className="card">
      <h2>Low wallet alert</h2>
      <p className="lead">Warn me when {kid.name}'s wallet goes under this. Leave it empty to use one day's limit.</p>
      {value === null && !status.err && <p className="lead">Loading…</p>}
      {value !== null && (
        <label className="day-limit">
          <span>Alert under</span>
          <span className="input">
            <span className="input__prefix">$</span>
            <input type="number" inputMode="decimal" min="1" max="100" step="0.5" placeholder={kid.dailyLimit.toFixed(2)}
              value={value} onChange={(e) => setValue(e.target.value)} />
          </span>
        </label>
      )}
      {status.err && <p className="form-error" role="alert">{status.err}</p>}
      {status.msg && <p className="form-ok" role="status">{status.msg}</p>}
      {value !== null && (
        <button type="button" className="btn btn--outline" onClick={save} disabled={status.busy}>
          {status.busy ? "Saving…" : "Save alert"}
        </button>
      )}
    </section>
  );
}
