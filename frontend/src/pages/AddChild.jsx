import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addChild } from "../api.js";
import { getSession } from "../session.js";
import { childErrors, focusFirst } from "../validate.js";
import Field from "../components/Field.jsx";
import Icon from "../components/Icon.jsx";
import BackButton from "../components/BackButton.jsx";
import { ALLERGENS } from "../components/ParentShell.jsx";

const COLOURS = ["#2F6DB5", "#B04E15", "#7B4CC2", "#B33F6A"];
const LIMITS = [400, 600, 800, 1000]; // cents
const EMPTY = { displayName: "", username: "", pin: "", colour: COLOURS[0], dailyLimitCents: 600, allergens: [] };
const toUsername = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20);

export default function AddChild() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [added, setAdded] = useState("");
  const [busy, setBusy] = useState(false);
  const name = form.displayName.trim() || "your child";

  function setName(e) {
    const displayName = e.target.value;
    setForm({ ...form, displayName, username: usernameEdited ? form.username : toUsername(displayName) });
  }
  const toggleAllergen = (a) =>
    setForm({ ...form, allergens: form.allergens.includes(a) ? form.allergens.filter((x) => x !== a) : [...form.allergens, a] });

  async function save(another) {
    const errs = childErrors(form);
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return focusFirst(errs);
    setBusy(true);
    try {
      await addChild(getSession().token, {
        ...form,
        displayName: form.displayName.trim(),
        allergens: form.allergens.map((a) => a.toLowerCase()),
      });
      if (!another) return navigate("/parent/home", { replace: true });
      setAdded(`${form.displayName.trim()} is added. Now add your next child.`);
      setForm(EMPTY);
      setUsernameEdited(false);
      window.scrollTo(0, 0);
    } catch (err) {
      setFormError(err.status === 409 ? "That login name is taken. Try another one." : err.message);
    }
    setBusy(false);
  }

  return (
    <main className="screen parent">
      <BackButton to="/parent/home" label="Skip for now" />
      <h1>Add your child</h1>
      <p className="lead">You can change any of this later. Add more children after this.</p>
      {added && <p className="form-ok" role="status">{added}</p>}

      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(false); }} noValidate>
        <Field id="displayName" label="Child's name" autoComplete="off" placeholder="e.g. Ethan"
          value={form.displayName} onChange={setName} error={errors.displayName} />
        <Field id="username" label={`${name === "your child" ? "Your child's" : name + "'s"} login name`}
          autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="e.g. ethan_eats"
          hint="They type this on the kid log in page."
          value={form.username} onChange={(e) => { setUsernameEdited(true); setForm({ ...form, username: e.target.value }); }}
          error={errors.username} />
        <Field id="pin" label="Secret code (4 numbers)" type="password" inputMode="numeric" autoComplete="new-password"
          maxLength={4} placeholder="••••" hint="Tell your child this code. Only you can change it."
          value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} error={errors.pin} />

        <fieldset>
          <legend>Pick {name}'s colour</legend>
          <div className="swatches">
            {COLOURS.map((c, i) => (
              <label key={c} className="swatch" style={{ "--swatch": c }}>
                <input type="radio" name="colour" value={c} checked={form.colour === c}
                  onChange={() => setForm({ ...form, colour: c })}
                  aria-label={["Blue", "Orange", "Purple", "Pink"][i]} />
                <span aria-hidden="true">{(form.displayName.trim()[0] || "?").toUpperCase()}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Daily food money</legend>
          <div className="chips">
            {LIMITS.map((cents) => (
              <label key={cents} className="chip chip--money">
                <input type="radio" name="limit" checked={form.dailyLimitCents === cents}
                  onChange={() => setForm({ ...form, dailyLimitCents: cents })} />
                <span>S${cents / 100}</span>
              </label>
            ))}
          </div>
          <p className="field__hint">A hawker meal near school is about S$3.50.</p>
        </fieldset>

        <fieldset>
          <legend>Allergies (tap any that apply)</legend>
          <div className="chips">
            {ALLERGENS.map((a) => {
              const on = form.allergens.includes(a);
              return (
                <label key={a} className="chip chip--allergy">
                  <input type="checkbox" checked={on} onChange={() => toggleAllergen(a)} />
                  <span><Icon name={on ? "check" : "plus"} size={16} strokeWidth={2.75} />{a}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="btn btn--primary" disabled={busy}>{busy ? "Saving…" : "Save and go to Home"}</button>
        <button type="button" className="btn btn--text" disabled={busy} onClick={() => save(true)}>
          <Icon name="plus" size={18} /> Save and add another child
        </button>
      </form>
    </main>
  );
}
