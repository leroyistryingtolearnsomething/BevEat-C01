import { useEffect, useRef, useState } from "react";
import { setAllergies } from "../api.js";
import CustomAllergies from "../components/CustomAllergies.jsx";
import FoodRuleSwitches from "../components/FoodRuleSwitches.jsx";
import { ALLERGENS, KidSwitcher, PageHeader, ParentTabs, useKids } from "../components/ParentShell.jsx";
import tickIcon from "../assets/figma/tick.svg";
import plusIcon from "../assets/figma/plus-dark.svg";
import shieldIcon from "../assets/figma/shield-warning.svg";

// a little picture for each allergy so they're quicker to spot
const ALLERGY_ICON = {
  peanut: "🥜", "tree nuts": "🌰", egg: "🥚", milk: "🥛", shellfish: "🦐",
  fish: "🐟", soy: "🫘", wheat: "🌾", sesame: "🫓",
};

// Parent edits a kid's allergies; removing one asks first, because those dishes come back
export default function ParentAllergies() {
  const { kids, kid, select, error, reload, token } = useKids();
  const [chosen, setChosen] = useState([]);
  const [confirm, setConfirm] = useState(null); // allergy key waiting for "remove?"
  const [status, setStatus] = useState({ busy: false, msg: "", err: "" });
  const dialog = useRef(null);

  useEffect(() => { if (kid) setChosen(kid.allergens); }, [kid?.id, kid?.allergens.join()]);
  useEffect(() => { if (confirm) dialog.current?.showModal(); }, [confirm]);

  const tap = (key) => {
    setStatus({ busy: false, msg: "", err: "" });
    if (!chosen.includes(key)) return setChosen([...chosen, key]);
    if (kid.allergens.includes(key)) return setConfirm(key); // saved allergy: ask before removing
    setChosen(chosen.filter((a) => a !== key));
  };
  const closeConfirm = (remove) => {
    if (remove) setChosen(chosen.filter((a) => a !== confirm));
    dialog.current?.close();
    setConfirm(null);
  };

  async function save() {
    setStatus({ busy: true, msg: "", err: "" });
    try {
      await setAllergies(token, kid.id, chosen);
      await reload();
      const msg = chosen.length ? "Saved. KiddyEats now blocks these dishes." : `Saved. No allergies set for ${kid.name}.`;
      setStatus({ busy: false, msg, err: "" });
    } catch (err) {
      setStatus({ busy: false, msg: "", err: err.message });
    }
  }

  return (
    <main className="screen parent with-tabs">
      <PageHeader title={kid ? `${kid.name}'s allergies` : "Allergies"} subtitle="KiddyEats blocks dishes with these"
        backTo={kid ? `/parent/home?kid=${kid.id}` : "/parent/home"} />
      {error && <p className="form-error" role="alert">{error}</p>}
      {!kids && !error && <p className="lead">Loading…</p>}

      {kid && (
        <>
          <KidSwitcher kids={kids} kid={kid} onSelect={select} />
          <FoodRuleSwitches token={token} kid={kid} />
          <section className="card">
            <h2>Allergies</h2>
            <p className="card__lead">Dishes with these never show up for {kid.name}, at any stall. Add-ons with them are hidden too.</p>
            <div className="chips allergy-chips">
              {ALLERGENS.map((label) => {
                const key = label.toLowerCase();
                const on = chosen.includes(key);
                return (
                  <button key={key} type="button" className="allergy-chip" aria-pressed={on} onClick={() => tap(key)}>
                    <img src={on ? tickIcon : plusIcon} alt="" width="16" height="16" />
                    <span className="allergy-chip__icon" aria-hidden="true">{ALLERGY_ICON[key]}</span>{label}
                  </button>
                );
              })}
            </div>
            <p className="card__hint">Tap an allergy to add or remove it</p>
          </section>

          {status.err && <p className="form-error" role="alert">{status.err}</p>}
          {status.msg && <p className="form-ok" role="status">{status.msg}</p>}
          <button className="btn btn--primary" onClick={save} disabled={status.busy}>
            {status.busy ? "Saving…" : "Save allergies"}
          </button>

          <CustomAllergies token={token} kid={kid} />
        </>
      )}

      <dialog ref={dialog} className="confirm" aria-labelledby="confirm-title" onCancel={() => setConfirm(null)}>
        {confirm && (
          <>
            <img src={shieldIcon} alt="" width="48" height="48" />
            <h2 id="confirm-title">Remove {confirm} allergy?</h2>
            <p>Dishes with {confirm} will show up for {kid.name} again, at every stall. They could order them.</p>
            <button className="btn btn--primary" autoFocus onClick={() => closeConfirm(false)}>Keep it blocked</button>
            <button className="btn btn--danger" onClick={() => closeConfirm(true)}>Remove allergy</button>
          </>
        )}
      </dialog>

      <ParentTabs active="allergies" kidId={kid?.id} />
    </main>
  );
}
