import { useEffect, useState } from "react";
import { getFoodRules, setFoodRules } from "../api.js";

// Mum's rules switches (Leslie, CB69-18, Figma 09d). Each switch saves as soon as it's flipped.
// The kid sees them as "Mum's rules for me" chips, and can still Ask Mum for a one-off yes.
const RULES = [
  { key: "noFried", title: "No fried food", hint: "Locks dishes like Mee Goreng, fried chicken and fries" },
  { key: "noSugary", title: "No sugary drinks", hint: "Locks drinks and desserts with 15 g of sugar or more, e.g. Milo Ice" },
];

export default function FoodRuleSwitches({ token, kid }) {
  const [rules, setRules] = useState(null);
  const [status, setStatus] = useState({ busy: "", msg: "", err: "" });

  useEffect(() => {
    setRules(null);
    getFoodRules(token, kid.id)
      .then(setRules)
      .catch((err) => setStatus({ busy: "", msg: "", err: err.message }));
  }, [token, kid.id]);

  async function flip(key) {
    const on = !rules[key];
    setStatus({ busy: key, msg: "", err: "" });
    try {
      setRules(await setFoodRules(token, kid.id, { [key]: on }));
      const title = RULES.find((r) => r.key === key).title;
      setStatus({ busy: "", msg: on ? `“${title}” is on for ${kid.name}.` : `“${title}” is off.`, err: "" });
    } catch (err) {
      setStatus({ busy: "", msg: "", err: err.message });
    }
  }

  return (
    <section className="card">
      <h2>Mum's rules</h2>
      <p className="card__lead">
        {kid.name} can tap <strong>Ask Mum</strong> on a locked dish, and you can say yes just once. Allergies can never be unlocked.
      </p>
      {!rules && !status.err && <p className="card__hint">Loading…</p>}
      {rules && (
        <ul className="rule-list">
          {RULES.map((r) => (
            <li key={r.key} className="rule-row">
              <div>
                <p className="rule-row__title" id={`rule-${r.key}`}>{r.title}</p>
                <p className="card__hint">{r.hint}</p>
              </div>
              <button type="button" role="switch" className="switch" aria-checked={rules[r.key]}
                aria-labelledby={`rule-${r.key}`} disabled={status.busy === r.key} onClick={() => flip(r.key)}>
                <span className="switch__knob" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {status.err && <p className="form-error" role="alert">{status.err}</p>}
      {status.msg && <p className="form-ok" role="status">{status.msg}</p>}
    </section>
  );
}
