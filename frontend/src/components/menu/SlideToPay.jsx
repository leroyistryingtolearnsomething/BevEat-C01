import { useEffect, useId, useRef, useState } from "react";
import { isComplete, keyStep, progressFromDrag } from "./slideToPay.js";

// 06 My tray: "Slide to pay S$4.60 →". The kid drags the round thumb to the right; only a slide
// of 90% or more pays, anything less springs back, so a stray tap can't spend their money.
//
// amount:     "S$4.60", or null while there's no fresh price (the label then has no amount)
// disabled:   can't pay right now (over budget, problem rows, or a quote is loading)
// paying:     the checkout call is on its way
// onComplete: called ONCE per slide. Tray.jsx then calls Leroy's POST /api/checkout.
export default function SlideToPay({ amount, disabled, paying, onComplete }) {
  const railRef = useRef(null);
  const drag = useRef(null); // { startX, maxX } while a finger or mouse is holding the thumb
  const progressRef = useRef(0); // the latest progress, for pointer handlers that run before a re-render
  const fired = useRef(false); // set once onComplete runs, so two quick slides can't pay twice
  const [progress, setProgressState] = useState(0);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();

  const locked = disabled || paying;
  const label = amount ? `Slide to pay ${amount}` : "Slide to pay";

  function setProgress(p) {
    progressRef.current = p;
    setProgressState(p);
  }

  function springBack() {
    drag.current = null;
    setDragging(false);
    setProgress(0);
  }

  // Paying finished while we're still on the tray, which means it FAILED (success leaves the
  // page). Back to the start so the kid can try again. Also runs if the tray stops being
  // payable mid-drag, e.g. the kid's quote is re-checked.
  useEffect(() => {
    if (paying) return;
    fired.current = false;
    springBack();
    // springBack only touches refs and state setters, so it doesn't need to be a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paying, disabled]);

  function complete() {
    if (fired.current || locked) return;
    fired.current = true;
    drag.current = null;
    setDragging(false);
    setProgress(1); // park the thumb at the end while "Paying…" shows
    onComplete();
  }

  // ----- touch, mouse and pen: Pointer Events cover all three -----

  function onPointerDown(e) {
    if (locked || (e.pointerType === "mouse" && e.button !== 0)) return;
    const maxX = railRef.current.getBoundingClientRect().width;
    // Remember where the finger "would be" at progress 0, so grabbing a thumb that isn't at
    // the start (rare) doesn't make it jump
    drag.current = { startX: e.clientX - progressRef.current * maxX, maxX };
    e.currentTarget.setPointerCapture(e.pointerId); // keep the drag even if the finger slips off the thumb
    setDragging(true);
  }

  function onPointerMove(e) {
    if (!drag.current) return;
    setProgress(progressFromDrag(drag.current.startX, e.clientX, drag.current.maxX));
  }

  function onPointerUp() {
    if (!drag.current) return;
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

  const classes = ["km-slide", locked && "km-slide--locked", dragging && "km-slide--dragging"].filter(Boolean).join(" ");

  return (
    <div className={classes} style={{ "--km-slide-p": progress }}>
      <span className="km-slide__label" aria-hidden="true">
        {paying ? (
          <>
            <span className="km-slide__spinner" /> Paying…
          </>
        ) : (
          `${label} →`
        )}
      </span>

      <div className="km-slide__rail" ref={railRef}>
        <button
          type="button"
          className="km-slide__thumb"
          aria-label={paying ? "Paying…" : label}
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
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <span id={hintId} className="sr-only">Slide right, or press Enter, to pay from your wallet.</span>
      <span className="sr-only" role="status">{paying ? "Paying…" : ""}</span>
    </div>
  );
}
