import { useEffect, useState } from "react";
import { getDayLimits, setDayLimits } from "../api.js";
import { money } from "./ParentShell.jsx";

const DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];

// different limit for some days, e.g. more on Friday. empty box = normal daily limit
export default function WeekdayLimits({ token, kid }) {
  const [values, setValues] = useState(null); // { mon: "3.00" or "" }
  const [status, setStatus] = useState({ busy: false, msg: "", err: "" });

  useEffect(() => {
    setValues(null);
    setStatus({ busy: false, msg: "", err: "" });
    getDayLimits(token, kid.id)
      .then((d) => setValues(Object.fromEntries(DAYS.map(([k]) => [k, d.days[k] === null ? "" : d.days[k].toFixed(2)]))))
      .catch((e) => setStatus({ busy: false, msg: "", err: e.message }));
  }, [token, kid.id]);

  async function save() {
    const days = {};
    for (const [k, label] of DAYS) {
      if (values[k] === "") continue;
      const cents = Math.round(Number(values[k]) * 100);
      if (!Number.isFinite(cents) || cents < 100 || cents > 5000)
        return setStatus({ busy: false, msg: "", err: `${label}: put S$1 to S$50, or leave it empty` });
      days[k] = cents;
    }
    setStatus({ busy: true, msg: "", err: "" });
    try {
      await setDayLimits(token, kid.id, days);
      setStatus({ busy: false, msg: "Saved weekday limits.", err: "" });
    } catch (e) {
      setStatus({ busy: false, msg: "", err: e.message });
    }
  }

  return (
    <section className="card">
      <h2>Different limit on some days</h2>
      <p className="lead">Leave a day empty to use the normal {money(kid.dailyLimit)}.</p>
      {!values && !status.err && <p className="lead">Loading…</p>}
      {values && (
        <div className="day-limits">
          {DAYS.map(([k, label]) => (
            <label key={k} className="day-limit">
              <span>{label}</span>
              <span className="input">
                <span className="input__prefix">S$</span>
                <input type="number" inputMode="decimal" min="1" max="50" step="0.5" placeholder="normal"
                  value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
              </span>
            </label>
          ))}
        </div>
      )}
      {status.err && <p className="form-error" role="alert">{status.err}</p>}
      {status.msg && <p className="form-ok" role="status">{status.msg}</p>}
      {values && (
        <button type="button" className="btn btn--outline" onClick={save} disabled={status.busy}>
          {status.busy ? "Saving…" : "Save weekday limits"}
        </button>
      )}
    </section>
  );
}
