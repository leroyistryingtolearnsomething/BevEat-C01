import { useEffect, useRef, useState } from "react";
import { addCustomAllergy, listCustomAllergies, removeCustomAllergy } from "../api.js";
import plusIcon from "../assets/figma/plus-white.svg";
import shieldIcon from "../assets/figma/shield-warning.svg";

// "Something else?" card on the parent's Allergies screen: allergies that aren't in the preset
// chips (kiwi, mango, coconut...). Each one saves straight away and shows the dishes it blocks,
// so the parent can check KiddyEats understood it. Matching happens in the database (migration 005).
export default function CustomAllergies({ token, kid }) {
  const [list, setList] = useState(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState({ busy: false, msg: "", err: "" });
  const [confirm, setConfirm] = useState(null); // allergy waiting for "remove?"
  const dialog = useRef(null);

  useEffect(() => {
    let live = true;
    setList(null);
    setStatus({ busy: false, msg: "", err: "" });
    listCustomAllergies(token, kid.id)
      .then((res) => live && setList(res.customAllergies))
      .catch((err) => live && setStatus({ busy: false, msg: "", err: err.message }));
    return () => { live = false; };
  }, [token, kid.id]);
  useEffect(() => { if (confirm) dialog.current?.showModal(); }, [confirm]);

  async function add(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setStatus({ busy: true, msg: "", err: "" });
    try {
      const res = await addCustomAllergy(token, kid.id, text);
      setList(res.customAllergies);
      const added = res.customAllergies[res.customAllergies.length - 1];
      const n = added.blockedDishes.length;
      setText("");
      setStatus({ busy: false, err: "",
        msg: n ? `Saved. ${added.label} blocks ${n} dish${n === 1 ? "" : "es"} right now.` : `Saved. No dish mentions ${added.label.toLowerCase()} right now.` });
    } catch (err) {
      setStatus({ busy: false, msg: "", err: err.message });
    }
  }

  async function closeConfirm(remove) {
    const target = confirm;
    dialog.current?.close();
    setConfirm(null);
    if (!remove) return;
    setStatus({ busy: true, msg: "", err: "" });
    try {
      await removeCustomAllergy(token, kid.id, target.id);
      setList((l) => l.filter((a) => a.id !== target.id));
      setStatus({ busy: false, msg: `Removed ${target.label}.`, err: "" });
    } catch (err) {
      setStatus({ busy: false, msg: "", err: err.message });
    }
  }

  return (
    <section className="card custom-allergies">
      <h2>Something else?</h2>
      <p className="card__lead">
        Type any other food {kid.name} can't eat. We hide dishes and add-ons whose name, description or
        ingredients mention it. Please tell the stall too, as hawkers don't always list everything.
      </p>

      {list === null && !status.err && <p className="card__hint">Loading…</p>}
      {list && list.length > 0 && (
        <ul className="custom-allergies__list">
          {list.map((a) => (
            <li key={a.id}>
              <div>
                <strong><span aria-hidden="true">{a.icon}</span> {a.label}</strong>
                <span className="card__hint">
                  {a.blockedDishes.length ? `Blocks: ${a.blockedDishes.join(", ")}` : "No dish mentions this right now"}
                </span>
              </div>
              <button type="button" className="custom-allergies__remove" onClick={() => setConfirm(a)}
                aria-label={`Remove ${a.label}`}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <form className="custom-allergies__form" onSubmit={add}>
        <label htmlFor="custom-allergy" className="sr-only">Other allergy</label>
        <div className="input">
          <input id="custom-allergy" value={text} maxLength={40} autoComplete="off"
            placeholder="e.g. Kiwi or Mango" onChange={(e) => setText(e.target.value)} />
        </div>
        <button className="btn btn--primary custom-allergies__add" disabled={status.busy || !text.trim()}>
          <img src={plusIcon} alt="" width="16" height="16" />Add
        </button>
      </form>

      {status.err && <p className="form-error" role="alert">{status.err}</p>}
      {status.msg && <p className="form-ok" role="status">{status.msg}</p>}

      <dialog ref={dialog} className="confirm" aria-labelledby="custom-confirm-title" onCancel={() => setConfirm(null)}>
        {confirm && (
          <>
            <img src={shieldIcon} alt="" width="48" height="48" />
            <h2 id="custom-confirm-title">Remove {confirm.label.toLowerCase()} allergy?</h2>
            <p>Dishes with {confirm.label.toLowerCase()} will show up for {kid.name} again. They could order them.</p>
            <button className="btn btn--primary" autoFocus onClick={() => closeConfirm(false)}>Keep it blocked</button>
            <button className="btn btn--danger" onClick={() => closeConfirm(true)}>Remove allergy</button>
          </>
        )}
      </dialog>
    </section>
  );
}
