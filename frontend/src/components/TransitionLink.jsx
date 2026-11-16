import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router-dom";

// What a dish card hands to the detail page, as { selector inside the card: view-transition name }.
// Like Figma's Smart Animate, layers with the same name on both screens morph into each other (see kidMotion.css).
export const DISH_MORPH = { ".km-card__photo": "dish-photo", ".km-card__name": "dish-name", ".km-pill--price": "dish-price" };

// Gives the named elements inside `root` their transition names; returns a function that takes the names off again.
// A selector of "&" means the root element itself (a card that is the link).
function nameThem(root, map) {
  // a name may only exist once on the page: the locked page's own photo carries "dish-photo" permanently, and the card you
  // tap there (an alternative dish) is about to take it, so drop the old holder first (it is leaving anyway)
  if (!root?.querySelector) return () => {};
  const mine = new Set(Object.values(map));
  document.querySelectorAll("[style*='view-transition-name']").forEach((el) => { if (mine.has(el.style.viewTransitionName) && !root.contains(el)) el.style.viewTransitionName = ""; });
  const els = [];
  for (const [selector, name] of Object.entries(map)) {
    const el = selector === "&" ? root : root.querySelector(selector);
    if (el && el.style) { el.style.viewTransitionName = name; els.push(el); }
  }
  const clear = () => els.forEach((el) => { el.style.viewTransitionName = ""; });
  setTimeout(clear, 2500); // never leave a name behind if a transition is cut short
  return clear;
}

// A <Link> that changes page inside the browser's view transition: the screens cross-fade, and the elements in `shared`
// grow into the same-named elements on the next page. (React Router's own `viewTransition` prop is dropped for routes
// inside a nested <Routes>, so this starts it by hand.) Browsers without the API (Firefox) just navigate.
// kind: "back" (returning to a screen already seen: 450ms fade) or "tab" (switching tabs: 200ms dissolve, as in the Figma
// prototype). Either way the arriving screen is just there, with no entrance animation of its own.
// shared: { selector: name } looked up inside the link (or on the whole page with scope="page", for a card that sits next to the
// link rather than inside it). arrive: { selector: name } looked up on the NEW page once it is drawn, so Back can shrink a hero
// into the card it came from.
export default function TransitionLink({ to, state, shared, scope, arrive, kind, onClick, ...rest }) {
  const navigate = useNavigate();

  function handleClick(e) {
    onClick?.(e);
    const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !rest.target;
    if (e.defaultPrevented || !plain || !document.startViewTransition) return; // Link's own click handles it
    e.preventDefault();
    const root = document.documentElement;
    if (kind) { root.dataset.vt = kind; root.dataset.back = ""; }
    const clear = shared ? nameThem(scope === "page" ? document : e.currentTarget, shared) : null; // only this card carries the names
    let clearArrive;
    const t = document.startViewTransition(() => {
      flushSync(() => navigate(to, { state }));
      if (arrive) clearArrive = nameThem(document, arrive);
    });
    t.finished.finally(() => {
      clear?.();
      clearArrive?.();
      if (kind) { delete root.dataset.vt; setTimeout(() => delete root.dataset.back, 1500); } // after the entrance animations are done
    });
  }

  return <Link to={to} state={state} onClick={handleClick} {...rest} />;
}

// Back, played in reverse like Figma's Back action: the detail page's photo, name and price shrink into the card
// you came from. `from` is the path you are leaving (that card's link). The page you return to doesn't replay its entrance.
export function backWithTransition(navigate, from) {
  if (!document.startViewTransition) return navigate(-1);
  const root = document.documentElement;
  root.dataset.back = "";
  let clear;
  const t = document.startViewTransition(async () => {
    navigate(-1);
    await new Promise((resolve) => {
      const started = Date.now();
      const check = () => {
        // the path changes first; a moment later React has drawn the page we return to
        if (window.location.pathname !== from || Date.now() - started > 600) setTimeout(resolve, 60);
        else setTimeout(check, 10);
      };
      check();
    });
    clear = nameThem(document.querySelector(`a[href="${from}"]`), DISH_MORPH);
  });
  // the entrance animations have long finished by then (the longest is under 1s), so lifting the rule restarts nothing
  t.finished.finally(() => { clear?.(); setTimeout(() => delete root.dataset.back, 1500); });
}
