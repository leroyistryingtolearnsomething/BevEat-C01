import { useEffect, useState } from "react";
import { getSpending } from "../api.js";
import { WEEK, filterDays, sumUp } from "../spendFilter.js";
import { KidSwitcher, PageHeader, ParentTabs, money, useKids } from "../components/ParentShell.jsx";

const SHORT_DAY = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
const SCHOOL = ["mon", "tue", "wed", "thu", "fri"];
const sameDays = (a, b) => a.length === b.length && a.every((d) => b.includes(d));
const dateLabel =(iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" });

// grey placeholder rows while the report loads
function SpendSkeleton() {
  return (
    <section className="card" aria-busy="true" aria-label="Loading report">
      <span className="skel skel--title" />
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className="skel skel--line" />)}
    </section>
  );
}

// Parent spending report: what the kid spent each day vs that day's limit
export default function ParentSpending() {
  const { kids, kid, select, error, token } = useKids();
  const [report, setReport] = useState(null);
  const [err, setErr] = useState("");
  // date filter, "YYYY-MM-DD". the api only goes back 30 days so we always get the month and filter here
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // which days of the week to show, all of them at the start
  const [picked, setPicked] = useState(WEEK);
  // keep them in mon-sun order so "School days" can be matched
  const toggleDay = (d) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : WEEK.filter((x) => x === d || p.includes(x))));

  useEffect(() => {
    if (!kid) return;
    setReport(null);
    setErr("");
    getSpending(token, kid.id, "month")
      .then((r) => {
        setReport(r);
        setFrom(r.days[Math.max(0, r.days.length - 7)].date); // start on the last 7 days like before
        setTo(r.to);
      })
      .catch((e) => setErr(e.message));
  }, [kid?.id, token]);

  const first = report ? report.from : "";
  const last = report ? report.to : "";
  const weekStart = report ? report.days[Math.max(0, report.days.length - 7)].date : "";
  const quick = [["Last 7 days", weekStart], ["Last 30 days", first]];

  // newest day first
  const days = report ? filterDays(report.days, { from, to, weekdays: picked }).reverse() : [];
  const sums = sumUp(days);
  // all bars use the same scale (biggest spent or limit) so the limit line can show where the limit is
  const scale = Math.max(1, ...days.map((d) => Math.max(d.spent, d.limit || 0)));

  return (
    <main className="screen parent with-tabs">
      <PageHeader title="Spending report" backTo={kid ? `/parent/home?kid=${kid.id}` : "/parent/home"} />
      {(error || err) && <p className="form-error" role="alert">{error || err}</p>}
      {!kids && !error && <SpendSkeleton />}

      {kid && (
        <>
          <KidSwitcher kids={kids} kid={kid} onSelect={select} />
          <div className="seg" role="group" aria-label="Show">
            {quick.map(([label, start]) => (
              <button key={label} type="button" disabled={!report} aria-pressed={!!report && from === start && to === last}
                onClick={() => { setFrom(start); setTo(last); }}>{label}</button>
            ))}
          </div>

          {!report && !err && <SpendSkeleton />}
          {report && (
            <>
              {/* pick any dates inside the last 30 days, e.g. 11 Nov to 15 Nov */}
              <section className="card spend-filter">
                <h2>Filter</h2>
                <div className="spend-filter__dates">
                  <label>From
                    <input type="date" value={from} min={first} max={to || last}
                      onChange={(e) => setFrom(e.target.value || first)} />
                  </label>
                  <label>To
                    <input type="date" value={to} min={from || first} max={last}
                      onChange={(e) => setTo(e.target.value || last)} />
                  </label>
                </div>
                <p className="spend-filter__note">Only the last 30 days can be shown</p>
                <div className="spend-filter__row">
                  <span className="spend-filter__label">Days</span>
                  <div className="spend-filter__quick">
                    {[["School days", SCHOOL], ["All days", WEEK]].map(([label, set]) => (
                      <button key={label} type="button" aria-pressed={sameDays(picked, set)} onClick={() => setPicked(set)}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* tap a day to hide / show it. green with a tick = shown, grey and crossed out = hidden */}
                <div className="spend-filter__days" role="group" aria-label="Days of the week">
                  {WEEK.map((d) => (
                    <button key={d} type="button" className="day-pill" aria-pressed={picked.includes(d)} onClick={() => toggleDay(d)}>
                      <span className="day-pill__tick" aria-hidden="true">✓</span>
                      {SHORT_DAY[d]}
                    </button>
                  ))}
                </div>
                <p className="spend-filter__note" aria-live="polite">
                  {picked.length === 7 ? "Showing every day" : picked.length === 0 ? "Pick at least one day" : `Showing ${picked.length} of 7 days`}
                </p>
              </section>

              <dl className="card facts">
                <div><dt>Total spent</dt><dd>{money(sums.total)}</dd></div>
                <div><dt>Average a day</dt><dd>{money(sums.averagePerDay)}</dd></div>
                <div><dt>Limit used</dt><dd>{sums.usedPct}%</dd></div>
                <div><dt>Days over the limit</dt><dd>{sums.daysOverLimit}</dd></div>
              </dl>

              {days.length === 0 ? (
                <section className="card spend-empty">
                  <span aria-hidden="true">🔍</span>
                  <h2>No days match</h2>
                  <p className="lead">Try picking more dates or days.</p>
                </section>
              ) : sums.total === 0 ? (
                // nothing bought yet, show a friendly message instead of empty bars
                <section className="card spend-empty">
                  <span aria-hidden="true">🍱</span>
                  <h2>No spending yet</h2>
                  <p className="lead">{kid.name} hasn't bought anything in these days. Orders will show up here.</p>
                </section>
              ) : (
                <section className="card">
                  <h2>Each day <small className="spend-count">{days.length} {days.length === 1 ? "day" : "days"}</small></h2>
                  {/* key changes with the filter so the list fades in again, makes the change easier to see */}
                  <ul className="spend-days spend-days--fade" key={`${from}-${to}-${picked.join("")}`}>
                    {days.map((d) => {
                      const pct = Math.min(100, (d.spent / scale) * 100);
                      const used = d.limit ? Math.round((d.spent / d.limit) * 100) : 0;
                      return (
                        <li key={d.date} className={d.overLimit ? "spend-day spend-day--over" : "spend-day"}>
                          <span className="spend-day__date">{SHORT_DAY[d.day]} {dateLabel(d.date)}</span>
                          <span className="spend-day__bar" title={`${used}% of the limit`} aria-hidden="true">
                            <span style={{ width: `${pct}%` }} />
                            {/* thin line where that day's limit is */}
                            {d.limit > 0 && <i className="spend-day__limit" style={{ left: `${(d.limit / scale) * 100}%` }} />}
                          </span>
                          <span className="spend-day__amt">{money(d.spent)} <small>/ {money(d.limit)}</small></span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="spend-key"><i className="spend-day__limit" aria-hidden="true" /> line = that day's limit</p>
                </section>
              )}
            </>
          )}
        </>
      )}

      <ParentTabs active="home" kidId={kid?.id} />
    </main>
  );
}
