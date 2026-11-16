import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { isComplete, keyStep, progressFromDrag } from "./slideToPay.js";

const SHAKE_MS = 360; // the "that didn't work" wiggle after a failed payment

// 06 My tray: "Slide to pay $4.60". The kid drags the round thumb to the right; only a slide
// of 90% or more pays, anything less springs back, so a stray tap can't spend their money.
//
// amount:     "$4.60", or null while there's no fresh price (the label then has no amount)
// disabled:   can't pay right now (over budget, problem rows, or a quote is loading)
// paying:     the checkout call is on its way
// paid:       optional. Payment went through: green track, a tick and "Paid!" until the page moves on
// onComplete: called ONCE per slide. Tray.jsx then calls Leroy's POST /api/checkout.
export default function SlideToPay({ amount, disabled, paying, paid = false, onComplete }) {
  const rootRef = useRef(null);
  const railRef = useRef(null);
  const drag = useRef(null); // { startX, maxX } while a finger or mouse is holding the thumb
  const lastX = useRef(0); // the newest pointer position, drawn on the next animation frame
  const frame = useRef(null); // the pending requestAnimationFrame id, if any
  const progressRef = useRef(0); // 0..1, the single source of truth for where the thumb is
  const fired = useRef(false); // set once onComplete runs, so two quick slides can't pay twice
  const wasPaying = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [shaking, setShaking] = useState(false);
  const hintId = useId();

  const locked = disabled || paying || paid;
  const label = amount ? `Slide to pay ${amount}` : "Slide to pay";
  const text = paid ? "Paid!" : paying ? "Paying…" : label;

  // Progress goes straight onto the element as a CSS variable, NOT through React state: the
  // thumb, the fill and the label's fade all read --km-slide-p, so a drag only changes one
  // style property per frame and never re-renders the component (smooth 60fps on old phones).
  function setProgress(p) {
    progressRef.current = p;
    if (rootRef.current) rootRef.current.style.setProperty("--km-slide-p", String(p));
  }

  function cancelFrame() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }

  function springBack() {
    cancelFrame();
    drag.current = null;
    setDragging(false);
    setProgress(0); // the CSS transition animates it home
  }

  useLayoutEffect(() => setProgress(progressRef.current), []); // first paint already has the variable
  useEffect(() => cancelFrame, []); // no drawing after the page has gone

  // Paying finished while we're still on the tray, which means it FAILED (success leaves the
  // page). A small shake, then back to the start so the kid can try again. Also runs if the tray
  // stops being payable mid-drag, e.g. the kid's quote is re-checked.
  useEffect(() => {
    if (paying || paid) {
      wasPaying.current = paying;
      setProgress(1); // parked at the end while "Paying…" / "Paid!" shows
      return undefined;
    }
    const failed = wasPaying.current;
    wasPaying.current = false;
    fired.current = false;
    springBack();
    if (!failed) return undefined;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), SHAKE_MS);
    return () => clearTimeout(timer);
    // springBack only touches refs and state setters, so it doesn't need to be a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paying, disabled, paid]);

  function complete() {
    if (fired.current || locked) return;
    fired.current = true;
    cancelFrame();
    drag.current = null;
    setDragging(false);
    setProgress(1); // snap to the end
    onComplete();
  }

  // ----- touch, mouse and pen: Pointer Events cover all three -----

  function onPointerDown(e) {
    if (locked || (e.pointerType === "mouse" && e.button !== 0)) return;
    const maxX = railRef.current.getBoundingClientRect().width;
    // Remember where the finger "would be" at progress 0, so grabbing a thumb that isn't at
    // the start (rare) doesn't make it jump
    drag.current = { startX: e.clientX - progressRef.current * maxX, maxX };
    lastX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId); // keep the drag even if the finger slips off the thumb
    setDragging(true);
  }

  // Pointer events can fire several times per screen refresh. Keep only the newest position and
  // draw it once, on the next frame.
  function onPointerMove(e) {
    if (!drag.current) return;
    lastX.current = e.clientX;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (drag.current) setProgress(progressFromDrag(drag.current.startX, lastX.current, drag.current.maxX));
    });
  }

  function onPointerUp(e) {
    if (!drag.current) return;
    cancelFrame();
    // judge the exact release point, not the last frame that happened to be drawn
    setProgress(progressFromDrag(drag.current.startX, e.clientX, drag.current.maxX));
    if (isComplete(progressRef.current)) complete();
    else springBack();
  }

  // ----- keyboard and screen readers -----

  // Enter / Space on a <button> fire a click with detail 0 (no mouse clicks were counted), and so
  // does a desktop screen reader's "activate". A real mouse click has detail >= 1 and is ignored:
  // with a mouse you have to slide.
  function onClick(e) {
    if (e.detail === 0) complete();
  }

  function onKeyDown(e) {
    if (locked) return;
    const next = keyStep(progressRef.current, e.key);
    if (next === null) return; // not our key: leave it alone (Tab, etc.)
    e.preventDefault(); // arrow keys must not scroll the page
    if (isComplete(next)) complete();
    else setProgress(next);
  }

  const classes = [
    "km-slide",
    disabled && !paying && !paid && "km-slide--locked", // grey: can't pay yet
    dragging && "km-slide--dragging",
    (paying || paid) && "km-slide--busy",
    paid && "km-slide--paid",
    shaking && "km-slide--shake",
  ].filter(Boolean).join(" ");

  return (
    <div ref={rootRef} className={classes}>
      {/* The darker mint trail behind the thumb. It moves with the thumb, under the label. */}
      <div className="km-slide__rail km-slide__rail--fill" aria-hidden="true">
        <div className="km-slide__runner"><span className="km-slide__fill" /></div>
      </div>
      <span className="km-slide__done" aria-hidden="true" />

      <span className="km-slide__label" aria-hidden="true">
        {!locked && !dragging && <span className="km-slide__sheen" />}
        <span className="km-slide__text">{text}</span>
      </span>

      <div className="km-slide__rail" ref={railRef}>
        <div className="km-slide__runner">
          <button
            type="button"
            className="km-slide__thumb"
            aria-label={paid ? "Paid!" : paying ? "Paying…" : label}
            aria-describedby={hintId}
            // aria-disabled, not disabled: a disabled button drops keyboard focus in the middle of paying
            aria-disabled={locked}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={springBack}
            onClick={onClick}
            onKeyDown={onKeyDown}
          >
            <ThumbIcon paying={paying} paid={paid} />
          </button>
        </div>
      </div>

      <span id={hintId} className="sr-only">Slide right, or press Enter, to pay from your wallet.</span>
      <span className="sr-only" role="status">{paid ? "Paid!" : paying ? "Paying…" : ""}</span>
    </div>
  );
}

// → chevron normally, a spinner while paying, a tick once paid. Decorative: the button's
// aria-label says the same thing in words.
function ThumbIcon({ paying, paid }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
  if (paid) return <svg {...common}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  if (paying) {
    return (
      <svg {...common} className="km-slide__spinner">
        <circle cx="12" cy="12" r="8.5" strokeOpacity="0.25" />
        <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" />
      </svg>
    );
  }
  return <svg {...common}><path d="M9.5 5.5L16 12l-6.5 6.5" /></svg>;
}
