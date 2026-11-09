import { useSearchParams } from "react-router-dom";
import { getChildOrders } from "../api.js";
import { PageHeader, ParentTabs, money, useKids } from "../components/ParentShell.jsx";
import { OrderList, dayLabel, kcal, useApi } from "../components/Macros.jsx";

// All orders (Figma 10c, "See all"). URL: /parent/orders?kid=16&range=this_week|last_week|this_month
const RANGES = [["this_week", "This week"], ["last_week", "Last week"], ["this_month", "This month"]];

export default function ParentOrders() {
  const { kid, error: kidsError, token } = useKids();
  const [params, setParams] = useSearchParams();
  const range = RANGES.some(([k]) => k === params.get("range")) ? params.get("range") : "this_week";
  const { data, error } = useApi(kid ? () => getChildOrders(token, kid.id, range) : null, [kid?.id, range]);
  const d = data?.child.id === kid?.id && data?.range === range ? data : null;

  const pick = (r) => setParams((p) => { p.set("range", r); return p; }, { replace: true });

  return (
    <main className="screen parent with-tabs m-screen">
      <PageHeader title={kid ? `${kid.name}'s orders` : "Orders"} subtitle="Every meal with its nutrients"
        backTo={kid ? `/parent/macros?kid=${kid.id}` : "/parent/home"} />
      <div className="m-chips" role="group" aria-label="Show orders from">
        {RANGES.map(([key, label]) => (
          <button key={key} type="button" className="m-chip" aria-pressed={range === key} onClick={() => pick(key)}>{label}</button>
        ))}
      </div>

      {(kidsError || error) && <p className="form-error" role="alert">{kidsError || error}</p>}
      {!d && !error && !kidsError && <p className="lead">Loading…</p>}
      {d && d.days.length === 0 && <p className="m-empty">No orders {RANGES.find(([k]) => k === range)[1].toLowerCase()}.</p>}
      {d?.days.map((day) => (
        <section key={day.date} className="m-day" aria-label={dayLabel(day.date)}>
          <div className="m-day__head">
            <h2>{day.date === d.today ? "Today · " : ""}{dayLabel(day.date)}</h2>
            <span>{kcal(day.kcal)} kcal · {money(day.total)}</span>
          </div>
          <OrderList orders={day.orders} />
        </section>
      ))}
      <ParentTabs active="home" kidId={kid?.id} />
    </main>
  );
}
