// Drag/hover-to-select for the parent app's single-choice button groups (kid chips, Allergies/Daily limit, Menu filter,
// Macros Today/Week, limit presets). A white glass capsule sits under the buttons, like the tab bar's pill: press and drag
// (or just hover with a mouse) and it follows on a spring, stretches with speed, and the option it is on reads as the main
// one. Release to select it. A plain tap is left alone (normal click). Works on the DOM, not React state, so no page needs
// changing. The multi-select allergy chips are not included.
const GROUPS = ".seg, .m-seg, .kid-switch, .presets";
const START = 6; // px of movement before a press becomes a drag
const CANCEL_PULL = 70; // let go this far above/below the group and nothing is selected
const AXES = ["x", "y", "w", "h"];
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const newSim = () => ({ x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0, tx: 0, ty: 0, tw: 0, th: 0, raf: 0, last: 0, el: null, group: null });

function draw(s, stretch = 1) {
  s.el.style.width = `${s.w}px`;
  s.el.style.height = `${s.h}px`;
  s.el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${stretch}, ${1 / Math.sqrt(stretch)})`;
}

// spring each of x/y/w/h toward its target; slightly bouncy, settles fast
function tick(s, t) {
  const dt = Math.min(0.032, (t - s.last) / 1000 || 0.016);
  s.last = t;
  let moving = 0;
  for (const k of AXES) {
    s["v" + k] += (380 * (s["t" + k] - s[k]) - 28 * s["v" + k]) * dt;
    s[k] += s["v" + k] * dt;
    moving += Math.abs(s["t" + k] - s[k]) + Math.abs(s["v" + k]);
  }
  if (moving < 0.6) {
    for (const k of AXES) { s[k] = s["t" + k]; s["v" + k] = 0; }
    s.raf = 0;
    return draw(s);
  }
  draw(s, 1 + Math.min(Math.hypot(s.vx, s.vy) / 2600, 0.12)); // stretches in the direction of travel
  s.raf = requestAnimationFrame((n) => tick(s, n));
}

function aim(s, r) { // r: { x, y, w, h } relative to the group
  Object.assign(s, { tx: r.x, ty: r.y, tw: r.w, th: r.h });
  if (reduceMotion()) {
    Object.assign(s, { x: r.x, y: r.y, w: r.w, h: r.h, vx: 0, vy: 0, vw: 0, vh: 0 });
    return draw(s);
  }
  if (!s.raf) {
    s.last = performance.now();
    s.raf = requestAnimationFrame((n) => tick(s, n));
  }
}

function nearest(buttons, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const b of buttons) {
    const r = b.getBoundingClientRect();
    const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
    if (d < bestD) { best = b; bestD = d; }
  }
  return best;
}

// The capsule lives inside the group, under the buttons (like the tab bar's pill), so the option it is on reads as the
// main/selected one. Rects passed to place() are viewport px; they are converted to group-relative here.
const origin = (group) => { const g = group.getBoundingClientRect(); return { x: g.left + group.clientLeft, y: g.top + group.clientTop }; };
const place = (sim, r) => { const o = origin(sim.group); aim(sim, { x: r.x - o.x, y: r.y - o.y, w: r.w, h: r.h }); };
const rectOf = (b) => { const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
const pressedIn = (buttons) => buttons.find((b) => b.getAttribute("aria-pressed") === "true");

function makeLens(group, from) {
  const sim = newSim();
  sim.group = group;
  const el = document.createElement("span");
  el.className = "glass-lens";
  el.setAttribute("aria-hidden", "true");
  el.style.borderRadius = getComputedStyle(from).borderRadius;
  group.appendChild(el);
  sim.el = el;
  group.setAttribute("data-drag", "");
  const r = rectOf(from);
  const o = origin(group);
  Object.assign(sim, { x: r.x - o.x, y: r.y - o.y, w: r.w, h: r.h, tx: r.x - o.x, ty: r.y - o.y, tw: r.w, th: r.h });
  draw(sim);
  requestAnimationFrame(() => el.classList.add("glass-lens--on"));
  return sim;
}

// spring the capsule onto `rect`, then fade it out and remove it
function settle(sim, rect) {
  place(sim, rect);
  setTimeout(() => {
    sim.el.classList.remove("glass-lens--on");
    setTimeout(() => { cancelAnimationFrame(sim.raf); sim.el.remove(); }, 200);
  }, 260);
}

export function installGlassDrag() {
  let drag = null; // press in progress: { group, down, buttons, sx, sy, active, hot, sim }
  let hover = null; // mouse resting over a group: { group, buttons, hot, sim }
  let swallow = false;

  const setHot = (o, button) => {
    if (o.hot === button) return;
    o.hot?.removeAttribute("data-lens");
    o.hot = button;
    button?.setAttribute("data-lens", "");
  };

  // where the capsule should be for this pointer, and which option it is over.
  // It stays strictly inside the span of the buttons themselves (not the whole row): no overshoot past the first/last one.
  const target = (e) => {
    const rects = drag.buttons.map((b) => b.getBoundingClientRect());
    const g = {
      left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)),
      top: Math.min(...rects.map((r) => r.top)), bottom: Math.max(...rects.map((r) => r.bottom)),
    };
    const b = nearest(drag.buttons, e.clientX, e.clientY);
    const r = b.getBoundingClientRect();
    const x = e.clientX - r.width / 2;
    const dy = e.clientY < g.top ? e.clientY - g.top : e.clientY > g.bottom ? e.clientY - g.bottom : 0;
    const clamped = Math.min(g.right - r.width, Math.max(g.left, x));
    return { b, dy, rect: { x: clamped, y: r.top, w: r.width, h: r.height } };
  };

  // ---- hover (mouse): the capsule slides to the option under the pointer, which then reads as the main one ----
  const stopHover = (immediate) => {
    const h = hover;
    if (!h) return;
    hover = null;
    h.group.removeAttribute("data-drag");
    h.hot?.removeAttribute("data-lens");
    if (immediate) { cancelAnimationFrame(h.sim.raf); h.sim.el.remove(); return; }
    settle(h.sim, rectOf(pressedIn(h.buttons) ?? h.buttons[0]));
  };
  const hoverMove = (e) => {
    const btn = e.target instanceof Element ? e.target.closest("button[aria-pressed]:not(:disabled)") : null;
    const group = btn?.closest(GROUPS);
    if (!btn || !group) return stopHover();
    if (hover && hover.group !== group) stopHover();
    if (!hover) {
      const buttons = [...group.querySelectorAll("button[aria-pressed]:not(:disabled)")];
      hover = { group, buttons, hot: null, sim: makeLens(group, pressedIn(buttons) ?? btn) };
    }
    setHot(hover, btn);
    place(hover.sim, rectOf(btn));
  };

  // ---- drag ----
  const begin = (e) => {
    stopHover(true);
    drag.active = true;
    drag.group.setPointerCapture(e.pointerId);
    drag.sim = makeLens(drag.group, pressedIn(drag.buttons) ?? drag.down);
  };

  // a lens left behind by a lost pointerup (window blur, release outside the page) is cleaned up on the next move or press
  const reset = () => {
    stopHover(true);
    if (!drag) return;
    drag.hot?.removeAttribute("data-lens");
    drag.group.removeAttribute("data-drag");
    if (drag.sim) { drag.sim.el?.remove(); cancelAnimationFrame(drag.sim.raf); }
    drag = null;
  };

  const onDown = (e) => {
    reset();
    if (e.button || !(e.target instanceof Element)) return;
    const group = e.target.closest(GROUPS);
    const down = e.target.closest("button[aria-pressed]");
    if (!group || !down || !group.contains(down)) return;
    const buttons = [...group.querySelectorAll("button[aria-pressed]:not(:disabled)")];
    drag = { group, down, buttons, sx: e.clientX, sy: e.clientY, active: false, hot: null, sim: null };
  };

  const onMove = (e) => {
    if (!drag) { if (e.pointerType === "mouse" && !e.buttons) hoverMove(e); return; }
    if (!e.buttons && e.pointerType === "mouse") return reset(); // button released somewhere we did not see
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < START) return;
      begin(e);
    }
    const t = target(e);
    setHot(drag, t.b);
    place(drag.sim, t.rect);
  };

  const finish = (e, cancelled) => {
    const d = drag;
    if (!d) return;
    if (!d.active) { drag = null; return; }
    const t = target(e);
    drag = null;
    d.group.removeAttribute("data-drag");
    d.hot?.removeAttribute("data-lens");
    if (d.group.hasPointerCapture?.(e.pointerId)) d.group.releasePointerCapture(e.pointerId); // already gone after a cancel
    const pressed = pressedIn(d.buttons);
    // dragged far away (or the gesture was cancelled): springs back and selects nothing
    const choice = cancelled || Math.abs(t.dy) > CANCEL_PULL ? pressed : t.b;
    swallow = false; // the click below is ours, let it through
    if (choice && choice !== pressed) choice.click();
    settle(d.sim, rectOf(choice ?? t.b));
  };

  const onUp = (e) => {
    if (drag?.active) { swallow = true; setTimeout(() => { swallow = false; }, 0); } // the browser still fires a click after a drag
    finish(e, false);
  };
  const onCancel = (e) => finish(e, true);
  const onClick = (e) => { if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); } };

  window.addEventListener("blur", reset);
  const events = [["pointerdown", onDown], ["pointermove", onMove], ["pointerup", onUp], ["pointercancel", onCancel], ["click", onClick]];
  for (const [n, f] of events) document.addEventListener(n, f, true);
  return () => { window.removeEventListener("blur", reset); for (const [n, f] of events) document.removeEventListener(n, f, true); };
}
