import { useEffect, useState } from "react";
import { getSpending } from "../api.js";
import { KidSwitcher, PageHeader, ParentTabs, money, useKids } from "../components/ParentShell.jsx";

const SHORT_DAY = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
const dateLabel = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" });

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

  return (
    <main className="screen parent with-tabs">
      <PageHeader title="Spending report" backTo={kid ? `/parent/home?kid=${kid.id}` : "/parent/home"} />
      {(error || err) && <p className="form-error" role="alert">{error || err}</p>}
      {!kids && !error && <p className="lead">Loading…</p>}

      {kid && (
        <>
          <KidSwitcher kids={kids} kid={kid} onSelect={select} />
          <div className="seg" role="group" aria-label="Show">
            {[["week", "Last 7 days"], ["month", "Last 30 days"]].map(([key, label]) => (
              <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>
            ))}
          </div>

          {!report && !err && <p className="lead">Loading…</p>}
          {report && (
            <>
              <dl className="card facts">
                <div><dt>Total spent</dt><dd>{money(report.total)}</dd></div>
                <div><dt>Average a day</dt><dd>{money(report.averagePerDay)}</dd></div>
                <div><dt>Days over the limit</dt><dd>{report.daysOverLimit}</dd></div>
              </dl>

              <section className="card">
                <h2>Each day</h2>
                <ul className="spend-days">
                  {days.map((d) => {
                    const pct = d.limit ? Math.min(100, (d.spent / d.limit) * 100) : 0;
                    return (
                      <li key={d.date} className={d.overLimit ? "spend-day spend-day--over" : "spend-day"}>
                        <span className="spend-day__date">{SHORT_DAY[d.day]} {dateLabel(d.date)}</span>
                        <span className="spend-day__bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                        <span className="spend-day__amt">{money(d.spent)} <small>/ {money(d.limit)}</small></span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}
        </>
      )}

      <ParentTabs active="home" kidId={kid?.id} />
    </main>
  );
}
