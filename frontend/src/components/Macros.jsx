import { useEffect, useState } from "react";
import "../macros.css";
import { useNavigate } from "react-router-dom";
import { clearSession } from "../session.js";
import { money } from "./ParentShell.jsx";

// Shared parts of the parent macros screens (CB69-50, Leslie). Every number comes from the API.

export const kcal = (n) => Math.round(n).toLocaleString("en-SG");
export const grams = (n) => (n === null || n === undefined ? "–" : `${Math.round(n)}g`);

// "2026-11-06" -> "Fri 6 Nov"
export const dayLabel = (date, opts = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" }).replace(",", "");
// ISO time -> "12:45pm" (Singapore time)
export const timeLabel = (iso) =>
  new Date(iso)
    .toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" })
    .replace(/\s/g, "")
    .toLowerCase();

// loads one API call; reloads when deps change; a 401 sends the parent back to log in
export function useApi(load, deps) {
  const navigate = useNavigate();
  const [state, setState] = useState({ data: null, error: "" });
  useEffect(() => {
    if (!load) return;
    let live = true;
    setState((s) => ({ data: s.data, error: "" }));
    load()
      .then((data) => live && setState({ data, error: "" }))
      .catch((err) => {
        if (!live) return;
        if (err.status === 401) {
          clearSession();
          return navigate("/parent/login", { replace: true });
        }
        setState({ data: null, error: err.message });
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

// ---------- energy card (green) ----------

export function EnergyCard({ title, value, unit, pct, meta, badge }) {
  return (
    <section className="m-energy" aria-label={title}>
      <div className="m-energy__top">
        <p className="m-energy__title">{title}</p>
        {badge}
      </div>
      <p className="m-energy__value"><strong>{value}</strong> {unit}</p>
      {pct !== null && (
        <div className="m-energy__bar" role="progressbar" aria-label="Share of the daily guide" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.min(100, pct)}>
          <span style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      <p className="m-energy__meta">{meta}</p>
    </section>
  );
}

// "about 66% of a 1,600 kcal day (age 9)"
export function guideText(guide, pct, age) {
  if (!guide) return "daily guide not set up yet";
  const who = age !== null ? `age ${age}` : `ages ${guide.ageFrom}–${guide.ageTo} guide`;
  return `about ${pct}% of a ${kcal(guide.kcal)} kcal day (${who})`;
}

// ---------- nutrient bars ----------

const STATUS = {
  on_target: { text: "On target", cls: "ok" },
  low: { text: "Low", cls: "warn" },
  high: { text: "A bit high", cls: "warn" },
};
// a short "what to do" for the day view
const LOW_HINT = { fibre: "add veg" };

export function NutrientCard({ title, nutrients, week }) {
  return (
    <section className="m-card" aria-label={title}>
      <div className="m-card__head">
        <h2>{title}</h2>
        <span className="m-card__aside">vs daily guide</span>
      </div>
      <ul className="m-bars">
        {nutrients.map((n) => {
          const s = STATUS[n.status];
          let tag = s?.text;
          if (n.status === "low" && !week && LOW_HINT[n.key]) tag = `Low – ${LOW_HINT[n.key]}`;
          if (n.status === "low" && week && n.daysCounted > 1) tag = `Low ${n.daysFlagged} of ${n.daysCounted} days`;
          const pct = n.target && n.actual !== null ? Math.min(100, (n.actual / n.target) * 100) : 0;
          return (
            <li key={n.key} className={`m-bar m-bar--${n.key}`}>
              <div className="m-bar__row">
                <span className="m-bar__label">
                  <span className="m-dot" aria-hidden="true" />
                  {n.label}
                  {tag && <span className={`m-tag m-tag--${s.cls}`}>{tag}</span>}
                </span>
                <span className="m-bar__nums">
                  {grams(n.actual)}{n.target ? ` / ${grams(n.target)}` : ""}
                </span>
              </div>
              <div className="m-bar__track"><span style={{ width: `${pct}%` }} /></div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- one order ----------

function AllergyTag({ order }) {
  if (order.allergyClashes.length)
    return <span className="m-tag m-tag--bad">Has {order.allergyClashes.join(", ").toLowerCase()}</span>;
  if (order.allergensChecked) return <span className="m-tag m-tag--ok">✓ Allergy safe</span>;
  return <span className="m-tag m-tag--grey" title="No allergy clash found, but the stall's allergen list hasn't been checked yet">Allergens not checked</span>;
}

export function OrderRow({ order }) {
  return (
    <li className="m-order">
      <div className="m-order__main">
        <p className="m-order__name">{order.name}</p>
        <p className="m-order__sub">{order.stall} · {timeLabel(order.placedAt)}</p>
        <p className="m-order__macros">
          <span className="m-kcal">{kcal(order.kcal)} kcal</span>
          C {grams(order.carbs)} · P {grams(order.protein)} · F {grams(order.fat)}
        </p>
      </div>
      <div className="m-order__side">
        <p className="m-order__price">{money(order.price)}</p>
        <AllergyTag order={order} />
      </div>
    </li>
  );
}

export function OrderList({ orders }) {
  return <ul className="m-orders">{orders.map((o) => <OrderRow key={o.id} order={o} />)}</ul>;
}
