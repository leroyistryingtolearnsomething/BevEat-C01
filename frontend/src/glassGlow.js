// Apple "interactive" Liquid Glass for the parent app's standalone buttons: a soft specular glow tracks the pointer across
// the glass while you press or drag (finger or mouse button), the control swells slightly while pressed and springs back with an overshoot.
// DOM-only (like glassDrag.js): a glow span is injected into the control, so no component needs changing.
// Segmented groups (.seg, .kid-switch, ...) and the tab bar already have their own sliding capsule, so they are skipped.
const TARGETS = ".parent .btn, .parent .back, .parent .allergy-chip, .parent a.m-home-link, .parent a.wallet__btn, .parent .hello__avatar";
const SKIP = ".seg, .m-seg, .kid-switch, .presets, .tabs";

export function installGlassGlow() {
  let cur = null;

  const glowOf = (el) => {
    let g = el.querySelector(":scope > .glass-glow");
    if (!g) {
      g = document.createElement("span");
      g.className = "glass-glow";
      g.setAttribute("aria-hidden", "true");
      el.appendChild(g);
    }
    return g;
  };

  const aim = (el, e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--gx", `${e.clientX - r.left}px`);
    el.style.setProperty("--gy", `${e.clientY - r.top}px`);
  };

  const find = (e) => {
    const el = e.target instanceof Element ? e.target.closest(TARGETS) : null;
    return el && !el.closest(SKIP) && !el.disabled ? el : null;
  };

  const leave = () => {
    if (!cur) return;
    cur.removeAttribute("data-glow");
    cur.removeAttribute("data-press");
    cur = null;
  };

  const move = (e) => { if (cur?.hasAttribute("data-press")) aim(cur, e); }; // follows only while pressed, never on a plain hover

  const down = (e) => {
    const el = find(e);
    if (!el) return;
    if (el !== cur) { leave(); cur = el; glowOf(el); }
    el.setAttribute("data-glow", "");
    el.setAttribute("data-press", "");
    aim(el, e);
  };

  const up = () => leave();

  const events = [["pointermove", move], ["pointerdown", down], ["pointerup", up], ["pointercancel", leave]];
  for (const [n, f] of events) document.addEventListener(n, f, true);
  document.addEventListener("pointerleave", leave, true);
  window.addEventListener("blur", leave);
  return () => {
    for (const [n, f] of events) document.removeEventListener(n, f, true);
    document.removeEventListener("pointerleave", leave, true);
    window.removeEventListener("blur", leave);
  };
}
