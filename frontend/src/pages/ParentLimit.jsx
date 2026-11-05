import { useEffect, useState } from "react";
import { setDailyLimit } from "../api.js";
import { KidSwitcher, PageHeader, ParentTabs, money, useKids } from "../components/ParentShell.jsx";

const PRESETS = [4, 6, 8, 10];

// Parent sets how much a kid can spend each day (S$2 to S$20 on the slider)
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
      <PageHeader title="Daily spending limit" backTo={kid ? `/parent/home?kid=${kid.id}` : "/parent/home"} />
      {error && <p className="form-error" role="alert">{error}</p>}
      {!kids && !error && <p className="lead">Loading…</p>}

      {kid && (
        <>
          <KidSwitcher kids={kids} kid={kid} onSelect={select} />
          <section className="limit-hero" aria-live="polite">
            <p>{kid.name} can spend up to</p>
            <p className="limit-hero__amount">{money(limit)}</p>
            <p className="limit-hero__small">a day at the hawker centre</p>
          </section>

          <section className="card">
            <label htmlFor="limit" className="sr-only">Daily limit in dollars</label>
            <input id="limit" type="range" className="limit-slider" min="2" max="20" step="0.5"
              value={limit} onChange={(e) => change(Number(e.target.value))}
              aria-valuetext={money(limit)} style={{ "--fill": `${((limit - 2) / 18) * 100}%` }} />
            <div className="limit-scale" aria-hidden="true"><span>S$2</span><span>S$20</span></div>
            <div className="chips presets">
              {PRESETS.map((v) => (
                <button key={v} type="button" className="preset" aria-pressed={limit === v} onClick={() => change(v)}>S${v}</button>
              ))}
            </div>
          </section>

          <dl className="card facts">
            <div><dt>Spent today</dt><dd>{money(kid.spentToday)}</dd></div>
            <div><dt>A hawker meal near school</dt><dd>about S$3.50</dd></div>
            <div><dt>Resets every day at</dt><dd>12:00 am</dd></div>
          </dl>

          {status.err && <p className="form-error" role="alert">{status.err}</p>}
          {status.msg && <p className="form-ok" role="status">{status.msg}</p>}
          <button className="btn btn--primary" onClick={save} disabled={status.busy}>
            {status.busy ? "Saving…" : "Save limit"}
          </button>
        </>
      )}

      <ParentTabs active="limit" kidId={kid?.id} />
    </main>
  );
}
