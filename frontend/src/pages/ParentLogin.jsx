import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parentLogin } from "../api.js";
import { saveSession } from "../session.js";
import { focusFirst, loginErrors } from "../validate.js";
import Field from "../components/Field.jsx";
import AppIcon from "../components/AppIcon.jsx";
import BackButton from "../components/BackButton.jsx";

export default function ParentLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const errs = loginErrors(form);
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return focusFirst(errs);
    setBusy(true);
    try {
      const { token, parent } = await parentLogin(form.email.trim(), form.password);
      saveSession({ token, role: "parent", name: parent.name });
      navigate("/parent/home", { replace: true });
    } catch (err) {
      setFormError(err.status === 401 ? "That email and password don't match. Try again." : err.message);
      setBusy(false);
    }
  }

  return (
    <main className="screen parent">
      <BackButton to="/" />
      <AppIcon />
      <h1>Welcome back</h1>
      <p className="lead">Log in to check today's meals, limits and wallet.</p>

      <form className="stack" onSubmit={submit} noValidate>
        <Field id="email" label="Email" type="email" autoComplete="email" inputMode="email"
          placeholder="name@example.com" value={form.email} onChange={set("email")} error={errors.email} />
        <Field id="password" label="Password" type="password" autoComplete="current-password"
          placeholder="Your password" value={form.password} onChange={set("password")} error={errors.password} />
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="btn btn--primary" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>

      <p className="foot">
        New here? <Link to="/parent/signup">Sign up</Link>
      </p>
    </main>
  );
}
