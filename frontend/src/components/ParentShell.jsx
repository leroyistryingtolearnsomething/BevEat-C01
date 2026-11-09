import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { listChildren } from "../api.js";
import { clearSession, getSession } from "../session.js";
import BackButton from "./BackButton.jsx";
import homeIcon from "../assets/figma/tab-home.svg";
import homeOnIcon from "../assets/figma/tab-home-on.svg";
import allergiesIcon from "../assets/figma/tab-allergies.svg";
import allergiesOnIcon from "../assets/figma/tab-allergies-on.svg";
import menuIcon from "../assets/figma/tab-menu.svg";
import menuOnIcon from "../assets/figma/tab-menu-on.svg";
import limitIcon from "../assets/figma/tab-limit.svg";
import limitOnIcon from "../assets/figma/tab-limit-on.svg";

// Shared parts of the parent app: the logged-in parent's kids, the kid switcher and the bottom tabs

export const money = (n) => `S$${n.toFixed(2)}`;
// shown on the chips; the API uses the same words in lower case ("tree nuts")
export const ALLERGENS = ["Peanut", "Tree nuts", "Egg", "Milk", "Shellfish", "Fish", "Soy", "Wheat", "Sesame"];
const KID_COLOURS = ["#2F6DB5", "#B04E15", "#7B4CC2", "#B33F6A"];

// loads the parent's kids; the selected kid lives in the URL (?kid=11) so it carries across tabs
export function useKids() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [kids, setKids] = useState(null);
  const [error, setError] = useState("");
  const { token } = getSession();

  const reload = useCallback(
    () =>
      listChildren(token)
        .then((d) => setKids(d.children))
        .catch((err) => {
          if (err.status !== 401) return setError(err.message);
          clearSession();
          navigate("/parent/login", { replace: true });
        }),
    [token, navigate]
  );
  useEffect(() => { reload(); }, [reload]);

  const kid = kids?.find((k) => String(k.id) === params.get("kid")) ?? kids?.[0];
  const select = (id) => setParams({ kid: id }, { replace: true });
  return { kids, kid, select, error, reload, token };
}

export function KidSwitcher({ kids, kid, onSelect }) {
  return (
    <div className="kid-switch" role="group" aria-label="Choose a child">
      {kids.map((k, i) => (
        <button key={k.id} type="button" className="kid-chip" aria-pressed={k.id === kid.id} onClick={() => onSelect(k.id)}>
          <span className="kid-chip__avatar" style={{ background: KID_COLOURS[i % KID_COLOURS.length] }} aria-hidden="true">
            {k.name[0]?.toUpperCase()}
          </span>
          {k.name}
        </button>
      ))}
    </div>
  );
}

const TABS = [
  { key: "home", label: "Home", to: "/parent/home", icon: homeIcon, iconOn: homeOnIcon },
  { key: "allergies", label: "Allergies", to: "/parent/allergies", icon: allergiesIcon, iconOn: allergiesOnIcon },
  { key: "menu", label: "Menu", to: "/parent/menu", icon: menuIcon, iconOn: menuOnIcon },
  { key: "limit", label: "Limit", to: "/parent/limit", icon: limitIcon, iconOn: limitOnIcon },
];

export function ParentTabs({ active, kidId }) {
  return (
    <nav className="tabs" aria-label="Parent app">
      {TABS.map((t) => {
        const on = t.key === active;
        const inner = (
          <>
            <span className="tabs__pill"><img src={on ? t.iconOn : t.icon} alt="" width="30" height="30" /></span>
            {t.label}
          </>
        );
        if (!t.to) return <span key={t.key} className="tabs__item" aria-disabled="true" title="Coming soon">{inner}</span>;
        return (
          <Link key={t.key} to={kidId ? `${t.to}?kid=${kidId}` : t.to} className="tabs__item" aria-current={on ? "page" : undefined}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}

// back button + title + optional subtitle, used at the top of each inner page
export function PageHeader({ title, subtitle, backTo }) {
  return (
    <header className="p-header">
      <BackButton to={backTo} />
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="lead">{subtitle}</p>}
      </div>
    </header>
  );
}
