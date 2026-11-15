import { useEffect, useState } from "react";
import { getSpending } from "../api.js";
import { KidSwitcher, PageHeader, ParentTabs, money, useKids } from "../components/ParentShell.jsx";

const SHORT_DAY = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
const dateLabel = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" });

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
  const [period, setPeriod] = useState("week");
  const [report, setReport] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!kid) return;
    setReport(null);
    setErr("");
    getSpending(token, kid.id, period).then(setReport).catch((e) => setErr(e.message));
  }, [kid?.id, period, token]);

  // newest day first
  const days = report ? [...report.days].reverse() : [];
  // all bars use the same scale (biggest spent or limit) so the limit line can show where the limit is
  const scale = Math.max(1, ...days.map((d) => Math.max(d.spent, d.limit || 0)));
  const limitTotal = days.reduce((sum, d) => sum + (d.limit || 0), 0);
  const usedPct = limitTotal ? Math.round((report.total / limitTotal) * 100) : 0;

  return (
    <main className="screen parent with-tabs">
      <PageHeader title="Spending report" backTo={kid ? `/parent/home?kid=${kid.id}` : "/parent/home"} />
      {(error || err) && <p className="form-error" role="alert">{error || err}</p>}
      {!kids && !error && <SpendSkeleton />}

      {kid && (
        <>
          <KidSwitcher kids={kids} kid={kid} onSelect={select} />
          <div className="seg" role="group" aria-label="Show">
            {[["week", "Last 7 days"], ["month", "Last 30 days"]].map(([key, label]) => (
              <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>
            ))}
          </div>

          {!report && !err && <SpendSkeleton />}
          {report && (
            <>
              <dl className="card facts">
                <div><dt>Total spent</dt><dd>{money(report.total)}</dd></div>
                <div><dt>Average a day</dt><dd>{money(report.averagePerDay)}</dd></div>
                <div><dt>Limit used</dt><dd>{usedPct}%</dd></div>
                <div><dt>Days over the limit</dt><dd>{report.daysOverLimit}</dd></div>
              </dl>

              {report.total === 0 ? (
                // nothing bought yet, show a friendly message instead of empty bars
                <section className="card spend-empty">
                  <span aria-hidden="true">🍱</span>
                  <h2>No spending yet</h2>
                  <p className="lead">{kid.name} hasn't bought anything in these days. Orders will show up here.</p>
                </section>
              ) : (
                <section className="card">
                  <h2>Each day</h2>
                  <ul className="spend-days">
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
