import { useState } from "react";
import { resetChildPin } from "../api.js";
import Field from "../components/Field.jsx";
import { KidSwitcher, PageHeader, ParentTabs, useKids } from "../components/ParentShell.jsx";

// Parent resets a kid's PIN (also unlocks them after 5 wrong tries)
export default function ParentPin() {
  const { kids, kid, select, error, token } = useKids();
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [status, setStatus] = useState({ busy: false, msg: "", err: "" });

  const onlyDigits = (v) => v.replace(/\D/g, "").slice(0, 4);

  // only ready when both are 4 numbers and match
  const ready = pin.length === 4 && pin === again;
  let matchHint = "✗ Type a 4 number PIN";
  if (pin.length === 4) matchHint = again.length === 0 ? "✗ Type it again to check" : "✗ Doesn't match yet";

  async function save(e) {
    e.preventDefault();
    if (pin.length !== 4) return setStatus({ busy: false, msg: "", err: "PIN must be 4 numbers" });
    if (pin !== again) return setStatus({ busy: false, msg: "", err: "The 2 PINs don't match" });
    setStatus({ busy: true, msg: "", err: "" });
    try {
      await resetChildPin(token, kid.id, pin);
      setPin("");
      setAgain("");
      setStatus({ busy: false, msg: `Done. ${kid.name} can log in with the new PIN now.`, err: "" });
    } catch (err) {
      setStatus({ busy: false, msg: "", err: err.message });
    }
  }

  return (
    <main className="screen parent with-tabs">
      <PageHeader title="Reset PIN" subtitle="If your child forgot it or got locked out"
        backTo={kid ? `/parent/home?kid=${kid.id}` : "/parent/home"} />
      {error && <p className="form-error" role="alert">{error}</p>}
      {!kids && !error && <p className="lead">Loading…</p>}

      {kid && (
        <>
          <KidSwitcher kids={kids} kid={kid} onSelect={(id) => { select(id); setStatus({ busy: false, msg: "", err: "" }); }} />
          <form className="stack" onSubmit={save}>
            {/* boxes stay red until both PINs are 4 numbers and the same, then go green */}
            <div className={`pin-boxes ${ready ? "pin-boxes--ok" : "pin-boxes--bad"}`}>
              <Field id="pin" label={`New PIN for ${kid.name}`} type="password" inputMode="numeric"
                autoComplete="new-password" value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))} hint="4 numbers" />
              <Field id="pin2" label="Type it again" type="password" inputMode="numeric"
                autoComplete="new-password" value={again} onChange={(e) => setAgain(onlyDigits(e.target.value))} />
              <p className="pin-boxes__hint" aria-live="polite">{ready ? "✓ PINs match, ready to save" : matchHint}</p>
            </div>
            {status.err && <p className="form-error" role="alert">{status.err}</p>}
            {status.msg && <p className="form-ok" role="status">{status.msg}</p>}
            <button className="btn btn--primary" disabled={status.busy || !ready}>{status.busy ? "Saving…" : "Save new PIN"}</button>
          </form>
        </>
      )}

      <ParentTabs active="home" kidId={kid?.id} />
    </main>
  );
}
