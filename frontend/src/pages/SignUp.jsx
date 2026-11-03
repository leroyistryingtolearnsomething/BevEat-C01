import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parentSignup } from "../api.js";
import { saveSession } from "../session.js";
import { focusFirst, signupErrors } from "../validate.js";
import Field from "../components/Field.jsx";
import AppIcon from "../components/AppIcon.jsx";
import BackButton from "../components/BackButton.jsx";

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", mobile: "", email: "", password: "", agreed: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: k === "agreed" ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    const errs = signupErrors(form);
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return focusFirst(errs);
    setBusy(true);
    try {
      const { token, parent } = await parentSignup({
        name: form.name.trim(),
        mobile: "+65" + form.mobile.replace(/\s/g, ""),
        email: form.email.trim(),
        password: form.password,
      });
      saveSession({ token, role: "parent", name: parent.name });
      navigate("/parent/add-child", { replace: true });
    } catch (err) {
      setFormError(err.status === 409 ? "There's already an account with that email. Log in instead." : err.message);
      setBusy(false);
    }
  }

  return (
    <main className="screen parent">
      <BackButton to="/" />
      <AppIcon />
      <h1>Create your parent account</h1>
      <p className="lead">Set your child's daily food money, block allergies, and top up with NETS QR.</p>

      <form className="stack" onSubmit={submit} noValidate>
        <Field id="name" label="Your name" autoComplete="name" placeholder="e.g. Tan Mei Ling"
          value={form.name} onChange={set("name")} error={errors.name} />
        <Field id="mobile" label="Mobile number" type="tel" autoComplete="tel-national" inputMode="numeric"
          prefix="+65" placeholder="8123 4567" maxLength={9}
          value={form.mobile} onChange={set("mobile")} error={errors.mobile} />
        <Field id="email" label="Email" type="email" autoComplete="email" inputMode="email"
          placeholder="name@example.com" value={form.email} onChange={set("email")} error={errors.email} />
        <Field id="password" label="Password" type="password" autoComplete="new-password"
          placeholder="At least 8 characters" hint="Use 8 or more characters with a number."
          value={form.password} onChange={set("password")} error={errors.password} />

        <div className="consent">
          <input id="agreed" type="checkbox" checked={form.agreed} onChange={set("agreed")}
            aria-invalid={errors.agreed ? true : undefined} aria-describedby={errors.agreed ? "agreed-error" : undefined} />
          <label htmlFor="agreed">
            I agree to the Terms and Privacy Policy. KiddyEats keeps your child's data private under the PDPA.
          </label>
        </div>
        {errors.agreed && <p className="field__error" id="agreed-error">{errors.agreed}</p>}

        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="btn btn--primary" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      </form>

      <p className="foot">
        Already have an account? <Link to="/parent/login">Log in</Link>
      </p>
    </main>
  );
}
