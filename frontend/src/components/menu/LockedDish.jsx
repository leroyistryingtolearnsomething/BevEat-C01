import { useEffect, useId, useState } from "react";
import BackCircle, { useGoBack } from "./BackCircle.jsx";
import DishCard from "./DishCard.jsx";
import DishPhoto from "./DishPhoto.jsx";
import AllergenBadges from "./AllergenBadges.jsx";
import { joinNames } from "./dishText.js";
import { askMum, getAskMum } from "../../api.js";
import blobAllergy from "../../assets/figma/menu/blob-allergy.svg";
import blobParent from "../../assets/figma/menu/blob-parent.svg";
import lock26 from "../../assets/figma/menu/lock-26.svg";
import send from "../../assets/figma/menu/send-22.svg";
import check22 from "../../assets/figma/menu/check-22.svg";

// 05 "Oops! allergy" and 05b "Mum says not today". Same layout, different colours, badge and words.
export default function LockedDish({ dish, alternatives, token }) {
  const allergy = dish.status === "blocked_allergy";
  const backTo = `/kid/stalls/${dish.stallId}`; // only when there's no previous page to go back to
  const goBack = useGoBack(backTo);

  return (
    <main className={`screen kid km-screen km-screen--locked ${allergy ? "km-screen--allergy" : "km-screen--parent"}`}>
      <img
        className={`blob km-blob ${allergy ? "km-blob--allergy" : "km-blob--parent"}`}
        src={allergy ? blobAllergy : blobParent}
        width="200"
        height="200"
        alt=""
        aria-hidden="true"
      />
      <div className="km-row">
        <BackCircle to={backTo} back />
      </div>

      <div className="km-badge-photo">
        <DishPhoto src={dish.imageUrl} name={dish.name} className="km-badge-photo__img" />
        {allergy ? (
          <>
            <span className="km-badge-photo__mark km-badge-photo__mark--allergy" aria-hidden="true">!</span>
            {/* one badge per allergen, like the menu card (the title already says them in words) */}
            <AllergenBadges allergens={dish.blockedAllergens} size={40} className="km-badge-photo__badges" />
          </>
        ) : (
          <span className="km-badge-photo__mark km-badge-photo__mark--parent" aria-hidden="true">
            <img src={lock26} width="26" height="26" alt="" />
          </span>
        )}
      </div>

      {allergy ? <AllergyWords dish={dish} /> : <ParentWords dish={dish} token={token} />}

      <section className="km-alt-box" aria-labelledby="km-alt-title">
        <h2 id="km-alt-title" className="km-h2">{allergy ? "Try these yummy picks instead" : "Or try these"}</h2>
        {alternatives.length > 0 ? (
          <div className="km-alt-row">
            {alternatives.map((d) => (
              <DishCard key={d.id} dish={d} flat />
            ))}
          </div>
        ) : (
          <p className="km-muted">No other picks here right now. Try another stall!</p>
        )}
      </section>

      <footer className="km-footer">
        <button type="button" onClick={goBack} className="km-big km-big--white">{allergy ? "Got it!" : "Pick something else"}</button>
      </footer>
    </main>
  );
}

function AllergyWords({ dish }) {
  if (dish.reason === "unknown_allergens") {
    return (
      <>
        <h1 className="km-title">Oops! We're not sure what's in {dish.name}</h1>
        <p className="km-lead">Nobody has checked it for allergies yet, so it's switched off to keep you safe.</p>
      </>
    );
  }
  const names = joinNames(dish.blockedAllergens.map((a) => a.name));
  return (
    <>
      <h1 className="km-title">Oops! {dish.name} has {names}</h1>
      <p className="km-lead">You're allergic to {names}, so this one is switched off to keep you safe.</p>
    </>
  );
}

// Why Mum said no: the Figma copy for "No fried food", or the rule's own label
function ruleText(dish) {
  const { type, label } = dish.parentRule;
  if (type === "no_fried") return `${dish.name} is fried, and Mum picked “No fried food” for school days.`;
  if (type === "no_sugary") return `${dish.name} has lots of sugar, and Mum picked “No sugary drinks” for school days.`;
  return `Mum picked “${label}”.`;
}

// The kid's optional note for Mum. Same rules as the server (parseAskMumNote): trimmed, at most
// 100 characters, counted with [...text] so an emoji counts as 1 (the input's maxLength would
// count it as 2, so it isn't used: the counter and the disabled button do the limiting).
const NOTE_MAX = 100;
const NOTE_CHIPS = ["I'm extra hungry today", "It's a special day", "Just this once please!"];
const noteLength = (text) => [...text.trim()].length;

function ParentWords({ dish, token }) {
  // null = still checking, then the request today (or none). "sending" while the tap is in flight.
  const [request, setRequest] = useState(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const noteId = useId();
  const tooLong = noteLength(note) > NOTE_MAX;

  // Coming back to 05b shows "Sent to Mum!" again if the kid already asked today
  useEffect(() => {
    getAskMum(token, dish.id)
      .then((data) => setRequest(data.request))
      .catch(() => setRequest(null)); // can't check: show the button; the server still blocks repeats
  }, [token, dish.id]);

  async function onAsk() {
    setSending(true);
    setError("");
    try {
      // an empty box is sent as no note at all; the server trims and checks it again
      setRequest(await askMum(token, dish.id, note.trim() || undefined));
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const sent = request && request.status;
  return (
    <>
      <h1 className="km-title">Mum says not today</h1>
      <p className="km-lead">{ruleText(dish)}</p>

      {sent ? (
        <>
          <p className="km-askmum km-askmum--sent" role="status">
            <img src={check22} width="22" height="22" alt="" /> Sent to Mum!
          </p>
          {/* plain text: React escapes it, so whatever the kid typed is shown exactly as words */}
          {request.note && <p className="km-note-quote">“{request.note}”</p>}
        </>
      ) : (
        <>
          <div className="km-note-box">
            <label className="km-note-label" htmlFor={`${noteId}-input`}>Add a note for Mum (optional)</label>
            <input
              id={`${noteId}-input`}
              className={`km-note-input${tooLong ? " km-note-input--over" : ""}`}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why today?"
              disabled={sending}
              aria-describedby={`${noteId}-count`}
              aria-invalid={tooLong}
              autoComplete="off"
            />
            <p id={`${noteId}-count`} className={`km-note-count${tooLong ? " km-note-count--over" : ""}`} aria-live="polite">
              {noteLength(note)}/{NOTE_MAX}
              {tooLong && <span> · a bit too long!</span>}
            </p>
            <div className="km-note-chips" role="group" aria-label="Quick notes">
              {NOTE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="km-note-chip"
                  aria-pressed={note.trim() === chip}
                  onClick={() => setNote(chip)}
                  disabled={sending}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={`km-askmum${tooLong ? " km-askmum--off" : ""}`}
            onClick={onAsk}
            disabled={sending || request === undefined || tooLong}
          >
            <img src={send} width="22" height="22" alt="" /> Ask Mum
          </button>
        </>
      )}

      <p className="km-caption" aria-live="polite">
        {error ||
          (sent === "denied"
            ? "Mum said no this time. You can ask again tomorrow!"
            : "Mum gets a ping on her phone and can say yes just this once.")}
      </p>
    </>
  );
}
