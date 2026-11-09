import { Link, useSearchParams } from "react-router-dom";
import { getMacrosDay, getMacrosWeek } from "../api.js";
import { KidSwitcher, PageHeader, ParentTabs, useKids } from "../components/ParentShell.jsx";
import { EnergyCard, NutrientCard, OrderList, dayLabel, guideText, kcal, useApi } from "../components/Macros.jsx";

// Parent macros (Figma 10a Today, 10b This week). URL: /parent/macros?kid=16&view=today|week&date=2026-11-05
const TIPS = {
  fibre_low: "Try adding a veggie side or fruit next week to bring fibre up.",
  protein_low: "Try a dish with more chicken or lean meat next week to bring protein up.",
  sugar_high: "Swap a sweet drink for plain water next week to bring sugar down.",
  fat_high: "Try a soup or steamed dish instead of fried food next week.",
  carbs_high: "Try a smaller rice or noodle portion with a veggie side next week.",
};

export default function ParentMacros() {
  const { kids, kid, error, token } = useKids();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "week" ? "week" : "today";
  const date = params.get("date") || undefined;

  const go = (changes) =>
    setParams((p) => {
      for (const [k, v] of Object.entries(changes)) (v ? p.set(k, v) : p.delete(k));
      return p;
    }, { replace: true });

  return (
    <main className="screen parent with-tabs m-screen">
      {error && <p className="form-error" role="alert">{error}</p>}
      {!kids && !error && <p className="lead">Loading…</p>}
      {kids?.length === 0 && <p className="lead">Add a child first to see their food.</p>}
      {kid && (view === "week"
        ? <Week token={token} kid={kid} kids={kids} go={go} />
        : <Day token={token} kid={kid} kids={kids} go={go} date={date} />)}
      <ParentTabs active="home" kidId={kid?.id} />
    </main>
  );
}

function Controls({ kids, kid, view, go }) {
  return (
    <div className="m-controls">
      <KidSwitcher kids={kids} kid={kid} onSelect={(id) => go({ kid: id, date: null })} />
      <div className="m-seg" role="group" aria-label="Show">
        <button type="button" aria-pressed={view === "today"} onClick={() => go({ view: null, date: null })}>Today</button>
        <button type="button" aria-pressed={view === "week"} onClick={() => go({ view: "week", date: null })}>This week</button>
      </div>
    </div>
  );
}

function Day({ token, kid, kids, go, date }) {
  const { data, error } = useApi(() => getMacrosDay(token, kid.id, date), [kid.id, date]);
  const d = data?.child.id === kid.id ? data : null;
  const today = !date || d?.isToday;
  const when = today ? "today" : `on ${dayLabel(date)}`;

  return (
    <>
      <PageHeader title={`${kid.name}'s food ${when}`} subtitle={today ? "Nutrients from today's orders" : "Nutrients from that day's orders"}
        backTo={today ? `/parent/home?kid=${kid.id}` : `/parent/macros?kid=${kid.id}&view=week`} />
      <Controls kids={kids} kid={kid} view={today ? "today" : null} go={go} />
      {error && <p className="form-error" role="alert">{error}</p>}
      {!d && !error && <p className="lead">Loading…</p>}
      {d && (
        <>
          <EnergyCard title={`Food energy ${when}`} value={kcal(d.totals.kcal)} unit="kcal" pct={d.energyPct}
            meta={`${d.meals} meal${d.meals === 1 ? "" : "s"} · ${guideText(d.guide, d.energyPct, d.child.age)}`} />
          <NutrientCard title="Nutrient balance" nutrients={d.nutrients} />
          <section>
            <div className="section-head">
              <h2>{today ? "Today's orders" : `Orders on ${dayLabel(d.date)}`}</h2>
              <Link to={`/parent/orders?kid=${kid.id}`} className="m-see-all">See all ›</Link>
            </div>
            {d.orders.length
              ? <OrderList orders={d.orders} />
              : <p className="m-empty">No orders {when} yet. Meals show up here as soon as {kid.name} orders.</p>}
          </section>
        </>
      )}
    </>
  );
}

function Week({ token, kid, kids, go }) {
  const { data, error } = useApi(() => getMacrosWeek(token, kid.id), [kid.id]);
  const w = data?.child.id === kid.id ? data : null;
  const lastDay = w?.days.at(-1)?.date;
  const max = w ? Math.max(1, ...w.days.map((d) => d.kcal)) : 1;
  const up = w?.vsLastWeekPct;

  return (
    <>
      <PageHeader title={`${kid.name}'s food this week`}
        subtitle={w ? `${dayLabel(w.start)} – ${dayLabel(lastDay)} · school days` : "This week"}
        backTo={`/parent/home?kid=${kid.id}`} />
      <Controls kids={kids} kid={kid} view="week" go={go} />
      {error && <p className="form-error" role="alert">{error}</p>}
      {!w && !error && <p className="lead">Loading…</p>}
      {w && (
        <>
          <EnergyCard title="Average food energy per day" value={kcal(w.avgKcal)} unit="kcal / day" pct={w.energyPct}
            badge={up !== null && (
              <span className="m-badge">{up >= 0 ? "▲" : "▼"} {Math.abs(up)}% vs last week</span>
            )}
            meta={`${w.meals} meal${w.meals === 1 ? "" : "s"} this week · ${guideText(w.guide, w.energyPct, w.child.age)}`} />

          <section className="m-card" aria-label="Calories each day">
            <div className="m-card__head">
              <h2>Calories each day</h2>
              <span className="m-card__aside">tap a day for details</span>
            </div>
            <div className="m-chart">
              {w.days.map((d) => (
                <Link key={d.date} className="m-chart__day" to={`/parent/macros?kid=${kid.id}&date=${d.date}`}
                  aria-current={d.date === lastDay ? "date" : undefined}
                  aria-label={`${dayLabel(d.date)}: ${kcal(d.kcal)} kcal, ${d.meals} meals`}>
                  <span className="m-chart__num">{d.meals ? kcal(d.kcal) : "–"}</span>
                  <span className="m-chart__bar" style={{ height: `${Math.max(4, (d.kcal / max) * 100)}%` }} />
                  <span className="m-chart__lbl">{dayLabel(d.date, { weekday: "short" })}</span>
                </Link>
              ))}
            </div>
          </section>

          <NutrientCard title="Average per day" nutrients={w.nutrients} week />
          {w.tip && TIPS[`${w.tip.nutrient}_${w.tip.status}`] && (
            <p className="m-tip"><span aria-hidden="true">💡</span>{TIPS[`${w.tip.nutrient}_${w.tip.status}`]}</p>
          )}
          {w.meals === 0 && <p className="m-empty">No orders this week yet.</p>}
        </>
      )}
    </>
  );
}
