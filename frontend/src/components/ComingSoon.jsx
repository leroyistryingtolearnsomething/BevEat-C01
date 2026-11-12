import { useEffect, useRef } from "react";
import ConstructionBao from "./ConstructionBao.jsx";

// "Not built yet" card for the kid tabs. A native <dialog>, so Esc, focus and the dimmed backdrop come for free.
// `what` is null (closed) or { title, text, thing }; onClose runs however it was closed (button, Esc or backdrop tap).
export default function ComingSoon({ what, onClose }) {
  const ref = useRef(null);
  useEffect(() => { if (what && !ref.current.open) ref.current.showModal(); }, [what]);
  return (
    <dialog
      ref={ref} className="soon" aria-labelledby="soon-title" onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) ref.current.close(); }} // only the backdrop is the dialog itself
    >
      {what && (
        <div className="soon__card">
          <ConstructionBao thing={what.thing} />
          <h2 id="soon-title">{what.title}</h2>
          <p>{what.text}</p>
          <button type="button" className="soon__ok" autoFocus onClick={() => ref.current.close()}>Got it</button>
        </div>
      )}
    </dialog>
  );
}
