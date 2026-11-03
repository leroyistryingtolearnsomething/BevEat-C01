import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { childLogin } from "../api.js";
import { saveSession } from "../session.js";
import Bao from "../components/Bao.jsx";
import Icon from "../components/Icon.jsx";

const PIN_LENGTH = 4;

export default function KidLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const press = (d) => {
    if (busy) return;
    setError("");
    setPin((p) => (p.length < PIN_LENGTH ? p + d : p));
  };
  const del = () => !busy && setPin((p) => p.slice(0, -1));

  // log in as soon as the 4th number is in
  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    if (!username.trim()) {
      setError("Type your nickname first!");
      setPin("");
      return;
    }
    setBusy(true);
    childLogin(username.trim(), pin)
      .then(({ token, child }) => {
        saveSession({ token, role: "child", name: child.displayName || child.username });
        navigate("/kid/home", { replace: true });
      })
      .catch((err) => {
        setError(err.status === 401 ? "Hmm, that didn't match. Try again!" : err.message);
        setPin("");
        setBusy(false);
      });
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  // number keys and Backspace work too, unless typing the nickname
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") del();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <main className="screen kid kid-login">
      <div className="blob blob--sun" aria-hidden="true" />
      <div className="blob blob--sky" aria-hidden="true" />
      <Link to="/" className="back back--kid" aria-label="Back">
        <Icon name="chevronLeft" size={22} strokeWidth={2.75} />
      </Link>

      <div className="kid-login__hi">
        <p className="bubble">Hi! Log in to KiddyEats</p>
        <Bao size={104} />
      </div>

      <div className="kid-field">
        <label htmlFor="nickname">Your nickname</label>
        <input id="nickname" value={username} onChange={(e) => { setUsername(e.target.value); setError(""); }}
          autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="e.g. ethan_eats" />
      </div>

      <p className="kid-login__label" id="code-label">Type your secret code</p>
      <div className={`dots${error ? " dots--wrong" : ""}`} aria-hidden="true">
        {Array.from({ length: PIN_LENGTH }, (_, i) => <span key={i} className={i < pin.length ? "on" : ""} />)}
      </div>
      <p className="sr-only" role="status">{pin.length} of {PIN_LENGTH} numbers typed</p>
      <p className="kid-login__error" role="alert">{error}</p>

      <div className="keypad" role="group" aria-labelledby="code-label">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className="key" onClick={() => press(d)} disabled={busy}>{d}</button>
        ))}
        <span />
        <button type="button" className="key" onClick={() => press("0")} disabled={busy}>0</button>
        <button type="button" className="key" onClick={del} disabled={busy} aria-label="Delete last number">
          <Icon name="backspace" size={26} />
        </button>
      </div>

      <p className="kid-login__help">Forgot your code? Ask your grown-up to reset it.</p>
    </main>
  );
}
