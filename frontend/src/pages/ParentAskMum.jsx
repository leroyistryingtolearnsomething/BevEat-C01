import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { decideAskMum, getAskMumRequest, listChildren } from "../api.js";
import { getSession } from "../session.js";
import { PageHeader, ParentTabs, money } from "../components/ParentShell.jsx";
import { DishThumb } from "../components/AskMum.jsx";
import Icon from "../components/Icon.jsx";

// One Ask Mum request (Leslie, CB69-26, Figma 09b): approve "just this once" or "not today".
// After answering, the same page shows 09c ("You said yes!") or the "not today" version.
// CB69-74 (Figma 09e/09f/09g): Mum can tap changes ("Less salt", "Less ice") before saying yes.
// They go on the stall's order ticket and the kid sees them as tags.

// Tapping one of these turns off the other, so "Less ice" + "No ice" can't both be on
const CLASHES = [["Less ice", "No ice"], ["Less sugar", "No sugar (kosong)"], ["Less ice", "Hot instead"], ["No ice", "Hot instead"]];
export default function ParentAskMum() {
  const { requestId } = useParams();
  const { token } = getSession();
  const [req, setReq] = useState(null);
  const [kid, setKid] = useState(null); // money left today, for the spend check
  const [note, setNote] = useState("");
  const [changes, setChanges] = useState([]); // Mum's chips, in the order they're shown
  const [status, setStatus] = useState({ busy: false, err: "" });
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    getAskMumRequest(token, requestId)
      .then(async ({ request }) => {
        setReq(request);
        const { children } = await listChildren(token);
        setKid(children.find((k) => k.id === request.childId) ?? null);
      })
      .catch((err) => setLoadErr(err.status === 404 ? "This request isn't here any more." : err.message));
  }, [token, requestId]);

  async function answer(decision) {
    setStatus({ busy: true, err: "" });
    try {
      const picked = decision === "approved" ? changes : undefined;
      const done = await decideAskMum(token, requestId, decision, note.trim() || undefined, picked);
      setReq({ ...req, status: done.status, decidedAt: done.decidedAt, parentNote: done.parentNote, changes: done.changes || [] });
      setStatus({ busy: false, err: "" });
    } catch (err) {
      setStatus({ busy: false, err: err.message });
    }
  }

  const home = req ? `/parent/home?kid=${req.childId}` : "/parent/home";
  const asked = req && new Date(req.createdAt).toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });

  return (
    <main className="screen parent with-tabs">
      <PageHeader title="Ask Mum request" subtitle={req ? `From ${req.childName} · today ${asked}` : ""} backTo={home} />
      {loadErr && (
        <>
          <p className="form-error" role="alert">{loadErr}</p>
          <Link to="/parent/home" className="btn btn--primary">Back to home</Link>
        </>
      )}
      {!req && !loadErr && <p className="lead">Loading…</p>}

      {req && req.status === "pending" && (
        <Review req={req} kid={kid} note={note} setNote={setNote} changes={changes} setChanges={setChanges}
          status={status} onAnswer={answer} />
      )}
      {req && req.status !== "pending" && <Answered req={req} home={home} />}

      <ParentTabs active="home" kidId={req?.childId} />
    </main>
  );
}

// 09b
function Review({ req, kid, note, setNote, changes, setChanges, status, onAnswer }) {
  const left = kid ? Math.max(0, kid.dailyLimit - kid.spentToday) : null;
  const after = left === null ? null : left - req.price;
  const drink = req.kind === "drink";
  const options = req.changeOptions || [];

  function toggle(option) {
    if (changes.includes(option)) return setChanges(changes.filter((c) => c !== option));
    const clashing = CLASHES.filter((pair) => pair.includes(option)).flat();
    const next = [...changes.filter((c) => !clashing.includes(c)), option];
    setChanges(options.filter((o) => next.includes(o))); // keep the chips' order
  }
  return (
    <>
      <section className="card am-request">
        <DishThumb imageUrl={req.imageUrl} size={110} wide />
        <div className="am-request__title">
          <h2>{req.dishName}</h2>
          <span className="am-price">{money(req.price)}</span>
        </div>
        <p className="card__hint">{req.stallName}</p>
        {req.ruleLabel ? (
          <p className="am-rule">🔒 Breaks your rule: {req.ruleLabel}</p>
        ) : (
          <p className="am-rule am-rule--off">This dish isn't locked any more, so {req.childName} can already buy it.</p>
        )}
      </section>

      {req.childNote && (
        <p className="am-kidnote">
          <span className="am-kidnote__who">{req.childName} says:</span> “{req.childNote}”
        </p>
      )}

      {options.length > 0 && (
        <section className="card am-changes" aria-labelledby="am-changes-title">
          <h3 id="am-changes-title">Make it {req.childName}'s way</h3>
          <p className="card__hint">Tap to add. The stall gets these with {req.childName}'s order.</p>
          <div className="am-chips">
            {options.map((o) => {
              const on = changes.includes(o);
              return (
                <button key={o} type="button" className={`am-chip${on ? " am-chip--on" : ""}`} aria-pressed={on}
                  onClick={() => toggle(o)} disabled={status.busy}>
                  {on && "✓ "}{o}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {left !== null && (
        <section className="card am-spend">
          <p><span>Food money left today</span><strong>{money(left)}</strong></p>
          <p>
            <span>After this {drink ? "drink" : "dish"}</span>
            {after >= 0 ? (
              <strong className="am-ok">{money(after)} · within limit</strong>
            ) : (
              <strong className="am-over">Over by {money(-after)}</strong>
            )}
          </p>
        </section>
      )}

      <label className="am-note">
        <span className="sr-only">Note for {req.childName}</span>
        <input type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={`Add a note for ${req.childName} (optional)`} />
      </label>

      {status.err && <p className="form-error" role="alert">{status.err}</p>}
      <div className="am-actions">
        <button className="btn btn--danger" disabled={status.busy} onClick={() => onAnswer("denied")}>Not today</button>
        <button className="btn btn--primary" disabled={status.busy} onClick={() => onAnswer("approved")}>
          {status.busy ? "Sending…" : changes.length ? "Yes, with changes" : "Yes, just this once"}
        </button>
      </div>
      <p className="card__hint">
        {changes.length
          ? `${req.childName} can buy this once today with ${changes.join(" · ")}. Your rules stay the same.`
          : `Saying yes lets ${req.childName} buy this ${drink ? "drink" : "dish"} once today. Your rules stay the same.`}
      </p>
    </>
  );
}

// 09c (yes) or the "not today" version
function Answered({ req, home }) {
  const yes = req.status === "approved";
  const changes = (yes && req.changes) || [];
  return (
    <>
      <section className="am-done">
        <span className={`am-done__ring ${yes ? "" : "am-done__ring--no"}`}>
          <Icon name={yes ? "check" : "x"} size={42} strokeWidth={3} />
        </span>
        <h2>{yes ? "You said yes!" : "You said not today"}</h2>
        <p className="lead">
          {yes
            ? `${req.childName} can buy ${req.dishName} once today${changes.length ? ", made your way" : ""}.${req.ruleLabel ? ` Your “${req.ruleLabel}” rule stays on.` : ""}`
            : `${req.dishName} stays locked. ${req.childName} can ask again tomorrow.`}
        </p>
      </section>

      <section className="card am-spend">
        <p><span>Dish</span><strong>{req.dishName}</strong></p>
        <p><span>Price</span><strong>{money(req.price)}</strong></p>
        {changes.length > 0 && (
          <>
            <p><span>Changes</span><strong className="am-ok">{changes.join(" · ")}</strong></p>
            <p><span>Sent to stall</span><strong>Printed on the order ticket</strong></p>
          </>
        )}
        {yes && <p><span>Pass valid</span><strong className="am-ok">Today only · 1 time</strong></p>}
        {req.childNote && <p><span>{req.childName}'s note</span><strong>“{req.childNote}”</strong></p>}
        {req.parentNote && <p><span>Your note</span><strong>“{req.parentNote}”</strong></p>}
      </section>

      <section className="am-kidsees" aria-label={`What ${req.childName} sees`}>
        <p className="am-kidsees__label">What {req.childName} sees</p>
        <p className="am-kidsees__title">{yes ? "Mum said yes!" : "Mum said no this time"}</p>
        <p>
          {yes
            ? `${req.dishName} is unlocked for today. ${changes.length ? "Mum asked for:" : "Tap to order."}`
            : "You can ask again tomorrow!"}
        </p>
        {changes.length > 0 && (
          <span className="am-kidtags">
            {changes.map((c) => <span key={c} className="am-kidtag">{c}</span>)}
          </span>
        )}
      </section>

      <Link to={home} className="btn btn--primary">Back to home</Link>
    </>
  );
}
