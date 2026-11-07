import { useEffect, useState } from "react";
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
  return `Mum picked “${label}”.`;
}

function ParentWords({ dish, token }) {
  // null = still checking, then the request today (or none). "sending" while the tap is in flight.
  const [request, setRequest] = useState(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

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
      setRequest(await askMum(token, dish.id));
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
        <p className="km-askmum km-askmum--sent" role="status">
          <img src={check22} width="22" height="22" alt="" /> Sent to Mum!
        </p>
      ) : (
        <button type="button" className="km-askmum" onClick={onAsk} disabled={sending || request === undefined}>
          <img src={send} width="22" height="22" alt="" /> Ask Mum
        </button>
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
