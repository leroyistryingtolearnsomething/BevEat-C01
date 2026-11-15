import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { setDailyLimit } from "../api.js";
import { KidSwitcher, PageHeader, ParentTabs, money, useKids } from "../components/ParentShell.jsx";
import WeekdayLimits from "../components/WeekdayLimits.jsx";
import Roll from "../components/Roll.jsx";
import SuccessCheck from "../components/SuccessCheck.jsx";
import WalletAlertSetting from "../components/WalletAlertSetting.jsx";

const PRESETS = [4, 6, 8, 10];
const HERO = { viewTransitionName: "parent-hero" }; // pairs with Home's "food money today" card (see TransitionLink)

// explains why the kid might not be able to spend the full limit today
// (kid can only spend the smaller of: what's left of today's limit, and the wallet)
function LimitHeadsUp({ kid }) {
  const today = kid.todayLimit ?? kid.dailyLimit;
  const leftToday = Math.max(today - kid.spentToday, 0);
  const dayName = new Date().toLocaleDateString("en-SG", { weekday: "long", timeZone: "Asia/Singapore" });
  const notes = [];

  // a weekday limit beats the normal one on that day
  if (today !== kid.dailyLimit) {
    notes.push(
      <div key="day" className="p-alert">
        <span aria-hidden="true">📅</span>
        <p>Today is {dayName}, so {kid.name}'s {dayName} limit of {money(today)} is used instead. Change it under the limits for each day below.</p>
      </div>
    );
  }
  // not enough in the wallet, raising the limit won't help
  if (kid.walletBalance < leftToday) {
    notes.push(
      <div key="wallet" className="p-alert">
        <span aria-hidden="true">👛</span>
        <p>{kid.name} only has {money(kid.walletBalance)} in the wallet, so that's the most they can spend today, even with a higher limit.</p>
        <Link to={`/parent/top-up?kid=${kid.id}`} className="edit-link">Top up</Link>
      </div>
    );
  }
  return notes.length ? <section className="p-alerts" aria-label="Heads up">{notes}</section> : null;
}

// Parent sets how much a kid can spend each day ($2 to $20 on the slider)
export default function ParentLimit() {
  const { kids, kid, select, error, reload, token } = useKids();
  const [limit, setLimit] = useState(5);
  const [status, setStatus] = useState({ busy: false, msg: "", err: "" });

  useEffect(() => { if (kid) setLimit(kid.dailyLimit); }, [kid?.id, kid?.dailyLimit]);
  const change = (v) => {
    setLimit(v);
    setStatus({ busy: false, msg: "", err: "" });
  };

  async function save() {
    setStatus({ busy: true, msg: "", err: "" });
    try {
      await setDailyLimit(token, kid.id, Math.round(limit * 100));
      await reload();
      setStatus({ busy: false, msg: `Saved. ${kid.name} can spend up to ${money(limit)} a day.`, err: "" });
    } catch (err) {
      setStatus({ busy: false, msg: "", err: err.message });
    }
  }

  return (
    <main className="screen parent with-tabs">
      <PageHeader title="Daily spending limit" backTo={kid ? `/parent/home?kid=${kid.id}` : "/parent/home"} arrive={{ ".today": "parent-hero" }} />
      {error && <p className="form-error" role="alert">{error}</p>}
      {!kids && !error && <p className="lead">Loading…</p>}

      {kid && (
        <>
          <KidSwitcher kids={kids} kid={kid} onSelect={select} />
          <section className="limit-hero" style={HERO} aria-live="polite">
            <p>{kid.name} can spend up to</p>
            <p className="limit-hero__amount"><Roll text={money(limit)} /></p>
            <p className="limit-hero__small">a day at the hawker centre</p>
          </section>

          <LimitHeadsUp kid={kid} />

          <section className="card">
            <label htmlFor="limit" className="sr-only">Daily limit in dollars</label>
            <input id="limit" type="range" className="limit-slider" min="2" max="20" step="0.5"
              value={limit} onChange={(e) => change(Number(e.target.value))}
              aria-valuetext={money(limit)} style={{ "--fill": `${((limit - 2) / 18) * 100}%` }} />
            <div className="limit-scale" aria-hidden="true"><span>$2</span><span>$20</span></div>
            <div className="chips presets">
              {PRESETS.map((v) => (
                <button key={v} type="button" className="preset" aria-pressed={limit === v} onClick={() => change(v)}>${v}</button>
              ))}
            </div>
          </section>

          <dl className="card facts">
            <div><dt>Spent today</dt><dd>{money(kid.spentToday)}</dd></div>
            <div><dt>A hawker meal near school</dt><dd>about $3.50</dd></div>
            <div><dt>Resets every day at</dt><dd>12:00 am</dd></div>
          </dl>

          {status.err && <p className="form-error" role="alert">{status.err}</p>}
          {status.msg && <p className="form-ok" role="status"><SuccessCheck size={24} />{status.msg}</p>}
          <button className="btn btn--primary" onClick={save} disabled={status.busy}>
            {status.busy ? "Saving…" : "Save limit"}
          </button>

          <WeekdayLimits token={token} kid={kid} />
          <WalletAlertSetting token={token} kid={kid} />
        </>
      )}

      <ParentTabs active="limit" kidId={kid?.id} />
    </main>
  );
}
