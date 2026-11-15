import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { listChildren } from "../api.js";
import { clearSession, getSession } from "../session.js";
import { refractFilter } from "../glassRefract.js";
import { recall, remember } from "../memo.js";
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

export const money = (n) => `$${n.toFixed(2)}`;
// shown on the chips; the API uses the same words in lower case ("tree nuts")
export const ALLERGENS = ["Peanut", "Tree nuts", "Egg", "Milk", "Shellfish", "Fish", "Soy", "Wheat", "Sesame"];
const KID_COLOURS = ["#2F6DB5", "#B04E15", "#7B4CC2", "#B33F6A"];

// loads the parent's kids; the selected kid lives in the URL (?kid=11) so it carries across tabs
export function useKids() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { token } = getSession();
  // the last list opens at once (then refreshes), so a page reached from another parent page has its kid and hero straight away
  const [kids, setKids] = useState(() => recall(`${token}:kids`));
  const [error, setError] = useState("");

  const reload = useCallback(
    () =>
      listChildren(token)
        .then((d) => setKids(remember(`${token}:kids`, d.children)))
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

// The glass capsule is driven by a spring (not a CSS transition) so it follows the finger continuously, stretches
// with speed, stays inside the bar, and can be grabbed mid-flight, like the iOS tab bar.
const PAD = 6;
const CANCEL_PULL = 70; // let go this far above/below the bar and nothing is selected
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ParentTabs({ active, kidId }) {
  const navigate = useNavigate();
  const nav = useRef(null);
  const pill = useRef(null);
  const sim = useRef({ x: null, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, raf: 0, last: 0 });
  const [over, setOver] = useState(null); // tab under the finger or mouse
  const [down, setDown] = useState(false);
  const activeIndex = TABS.findIndex((t) => t.key === active);
  const lens = over ?? activeIndex;
  const href = (t) => (kidId ? `${t.to}?kid=${kidId}` : t.to);

  const itemW = () => (nav.current.clientWidth - PAD * 2) / TABS.length;
  const draw = (s, stretch = 1) => {
    pill.current.style.transform = `translate(${s.x}px, ${s.y}px) scale(${stretch}, ${1 / Math.sqrt(stretch)})`;
  };
  const tick = (t) => {
    const s = sim.current;
    const dt = Math.min(0.032, (t - s.last) / 1000 || 0.016);
    s.last = t;
    s.vx += (380 * (s.tx - s.x) - 28 * s.vx) * dt; // spring: slightly bouncy, settles fast
    s.vy += (380 * (s.ty - s.y) - 28 * s.vy) * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const still = Math.abs(s.tx - s.x) < 0.1 && Math.abs(s.ty - s.y) < 0.1 && Math.abs(s.vx) + Math.abs(s.vy) < 5;
    if (still) { Object.assign(s, { x: s.tx, y: s.ty, vx: 0, vy: 0, raf: 0 }); return draw(s); }
    draw(s, 1 + Math.min(Math.hypot(s.vx, s.vy) / 2600, 0.1)); // stretches in the direction of travel
    s.raf = requestAnimationFrame(tick);
  };
  const aim = (x, y = 0) => {
    const s = sim.current;
    s.tx = x; s.ty = y;
    if (s.x === null || reduceMotion()) { Object.assign(s, { x, y, vx: 0, vy: 0 }); return draw(s); }
    if (!s.raf) { s.last = performance.now(); s.raf = requestAnimationFrame(tick); }
  };
  const rest = (i) => aim(PAD + itemW() * i);

  // not dragging: rest on the active tab. dragging: follow the finger (set in follow())
  useEffect(() => { if (!down) rest(lens); }, [lens, down]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(sim.current.raf), []);
  useEffect(() => { // Chromium: the bar bends what is behind its rim, like iOS 26
    const r = nav.current.getBoundingClientRect();
    const f = refractFilter(r.width, r.height, 36, 16, 18);
    if (f) nav.current.style.backdropFilter = `${f} blur(8px) saturate(1.8)`;
  }, []);

  const indexAt = (e) => {
    const r = nav.current.getBoundingClientRect();
    return Math.min(TABS.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * TABS.length)));
  };
  const pull = (e) => { // how far the finger is above/below the bar's middle
    const r = nav.current.getBoundingClientRect();
    const dy = e.clientY - (r.top + r.height / 2);
    return Math.sign(dy) * Math.max(0, Math.abs(dy) - r.height / 2);
  };
  const follow = (e) => {
    const r = nav.current.getBoundingClientRect();
    const lo = PAD, hi = r.width - PAD - itemW();
    const x = e.clientX - r.left - itemW() / 2;
    aim(Math.min(hi, Math.max(lo, x)), 0); // stays inside the bar: no overshoot past the ends, no lifting out of it
  };
  const move = (e) => {
    if (down) { follow(e); setOver(indexAt(e)); } // a mouse that is only hovering does nothing
  };
  const release = (e) => {
    if (!down) return;
    const i = indexAt(e);
    const cancelled = Math.abs(pull(e)) > CANCEL_PULL; // dragged away: springs back, selects nothing
    setDown(false);
    setOver(null);
    if (!cancelled && i !== activeIndex) navigate(href(TABS[i]));
    else rest(activeIndex);
  };

  return (
    <nav
      ref={nav} className="tabs" aria-label="Parent app" data-dragging={down || undefined}
      onPointerDown={(e) => { if (e.button) return; e.currentTarget.setPointerCapture(e.pointerId); setDown(true); setOver(indexAt(e)); follow(e); }}
      onPointerMove={move} onPointerUp={release}
      onPointerCancel={() => { setDown(false); setOver(null); }} onPointerLeave={() => !down && setOver(null)}
      // a pointer tap is handled on release; keyboard activation (detail 0) still follows the link
      onClick={(e) => { if (e.detail) e.preventDefault(); }}
    >
      <span ref={pill} className="tabs__lens" aria-hidden="true" />
      {TABS.map((t, i) => {
        const on = t.key === active;
        return (
          <Link key={t.key} to={href(t)} className="tabs__item" aria-current={on ? "page" : undefined} data-lens={i === lens || undefined} draggable="false">
            <span className="tabs__pill"><img src={i === lens ? t.iconOn : t.icon} alt="" width="30" height="30" draggable="false" /></span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// back button + title + optional subtitle, used at the top of each inner page
export function PageHeader({ title, subtitle, backTo, arrive }) {
  return (
    <header className="p-header">
      <BackButton to={backTo} arrive={arrive} />
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="lead">{subtitle}</p>}
      </div>
    </header>
  );
}
