import { useEffect, useState } from "react";
import { getChildMenu, setDishLocked } from "../api.js";
import { KidSwitcher, PageHeader, ParentTabs, money, useKids } from "../components/ParentShell.jsx";
import Icon from "../components/Icon.jsx";

const TABS = [
  { key: "kid", label: "Kid's view" },
  { key: "open", label: "Open" },
  { key: "blocked", label: "Blocked" },
];

// Parent Menu (Figma 04): what the kid sees. Allergy dishes are hidden from the kid completely and
// can't be changed here. The parent can lock any other dish: the kid's menu then shows it as "Mum says no".
export default function ParentMenu() {
  const { kids, kid, select, error: loadError, token } = useKids();
  const [dishes, setDishes] = useState(null);
  const [tab, setTab] = useState("kid");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(() => new Set()); // dish ids with a lock change in flight

  useEffect(() => {
    if (!kid) return;
    let current = true;
    setDishes(null);
    setError("");
    getChildMenu(token, kid.id)
      .then((d) => current && setDishes(d.dishes))
      .catch((err) => current && setError(err.message));
    return () => { current = false; };
  }, [token, kid?.id]);

  async function toggle(dish) {
    const locked = !dish.locked;
    setError("");
    setBusy((b) => new Set(b).add(dish.id));
    const mark = (value) => setDishes((list) => list.map((d) => (d.id === dish.id ? { ...d, locked: value } : d)));
    mark(locked); // show it straight away, undo if the server says no
    try {
      await setDishLocked(token, kid.id, dish.id, locked);
    } catch (err) {
      mark(!locked);
      setError(err.message);
    }
    setBusy((b) => { const n = new Set(b); n.delete(dish.id); return n; });
  }

  const hidden = dishes?.filter((d) => d.allergyBlocked) ?? [];
  const open = dishes?.filter((d) => !d.allergyBlocked && !d.locked) ?? [];
  const lockedByYou = dishes?.filter((d) => !d.allergyBlocked && d.locked) ?? [];
  const shown = {
    kid: [...open, ...lockedByYou].sort((a, b) => a.id - b.id), // what the kid sees: allergy dishes are gone
    open,
    blocked: [...lockedByYou, ...hidden],
  }[tab];
  const counts = { kid: open.length + lockedByYou.length, open: open.length, blocked: lockedByYou.length + hidden.length };

  return (
    <main className="screen parent with-tabs">
      <PageHeader title={kid ? `What ${kid.name} sees` : "Menu"} subtitle="The menu with allergies and limit applied"
        backTo={kid ? `/parent/home?kid=${kid.id}` : "/parent/home"} />
      {(loadError || error) && <p className="form-error" role="alert">{loadError || error}</p>}
      {!kids && !loadError && <p className="lead">Loading…</p>}
      {kids?.length === 0 && <p className="lead">Add a child first to see their menu.</p>}

      {kid && (
        <>
          <KidSwitcher kids={kids} kid={kid} onSelect={select} />
          <div className="seg seg--3" role="group" aria-label="Show">
            {TABS.map((t) => (
              <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}{dishes && t.key !== "kid" ? ` (${counts[t.key]})` : ""}
              </button>
            ))}
          </div>

          {hidden.length > 0 && (
            <p className="menu-banner" role="note">
              <span className="menu-banner__icon" aria-hidden="true">!</span>
              {hidden.length} {hidden.length === 1 ? "dish is" : "dishes are"} hidden because of {kid.name}'s allergies. They won't see {hidden.length === 1 ? "it" : "them"} at all.
            </p>
          )}
          {lockedByYou.length > 0 && tab === "kid" && (
            <p className="menu-note">Locked dishes show as “Mum says no” on {kid.name}'s menu.</p>
          )}

          {!dishes && !error && <p className="lead">Loading the menu…</p>}
          {dishes && shown.length === 0 && (
            <p className="lead">{tab === "blocked" ? "Nothing is blocked." : "No dishes to show."}</p>
          )}
          {dishes && shown.length > 0 && (
            <ul className="menu-grid">
              {shown.map((d) => (
                <li key={d.id} className={`menu-dish${d.allergyBlocked ? " menu-dish--allergy" : d.locked ? " menu-dish--locked" : ""}`}>
                  <div className="menu-dish__photo">
                    {d.imageUrl ? <img src={d.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">🍽️</span>}
                    {d.locked && !d.allergyBlocked && <span className="menu-dish__badge"><Icon name="lock" size={14} strokeWidth={2.5} /> Locked</span>}
                  </div>
                  <h3>{d.name}</h3>
                  <p className="menu-dish__stall">{d.stallName}</p>
                  <span className="menu-dish__price">{money(d.price)}</span>
                  {d.allergyBlocked ? (
                    <p className="menu-dish__allergy">Hidden: allergy</p>
                  ) : (
                    <button type="button" className={`btn ${d.locked ? "btn--outline" : "btn--danger"} menu-dish__btn`}
                      onClick={() => toggle(d)} disabled={busy.has(d.id)}
                      aria-label={`${d.locked ? "Unlock" : "Lock"} ${d.name}`}>
                      {d.locked ? "Unlock" : "Lock"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ParentTabs active="menu" kidId={kid?.id} />
    </main>
  );
}
