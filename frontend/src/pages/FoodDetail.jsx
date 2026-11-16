import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getDish } from "../api.js";
import { getSession } from "../session.js";
import { addLine, loadTray, saveTray, formatSgd, moneyLeftCents, toCents as cents, MAX_QTY } from "../tray.js";
import { recall, remember } from "../memo.js";
import BackCircle from "../components/menu/BackCircle.jsx";
import DishPhoto from "../components/menu/DishPhoto.jsx";
import ExtrasList from "../components/menu/ExtrasList.jsx";
import LockedDish from "../components/menu/LockedDish.jsx";
import camera from "../assets/figma/menu/camera-14.svg";
import check18 from "../assets/figma/menu/check-18.svg";
import heartVote from "../assets/figma/menu/heart-vote.svg";
import heartVoteLiked from "../assets/figma/menu/heart-vote-liked.svg";
import leafOn from "../assets/figma/menu/leaf-18-on.svg";
import leafOff from "../assets/figma/menu/leaf-18-off.svg";
import minus from "../assets/figma/menu/minus-20.svg";
import plus from "../assets/figma/menu/plus-20.svg";
import "./kidMenu.css";

// pair with the tapped card's photo, name and price (DISH_MORPH in TransitionLink)
const PHOTO_MORPH = { viewTransitionName: "dish-photo" };
const NAME_MORPH = { viewTransitionName: "dish-name" };
const PRICE_MORPH = { viewTransitionName: "dish-price" };

// Kids Figma 04 Food detail. If the server says this dish is locked for this child, the same
// URL shows 05 (allergy) or 05b (Mum says no) instead, so a deep link can never reach
// "Add to my tray" for a locked dish.
export default function FoodDetail() {
  const { itemId } = useParams();
  const { state } = useLocation(); // { img, name } when the kid tapped a dish card
  const { token } = getSession();
  const memoKey = `${token}:dish:${itemId}`;
  const [data, setData] = useState(() => recall(memoKey)); // the last copy opens at once, then refreshes
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    setData(recall(memoKey)); // tapping an alternative opens another dish: show its last copy, or loading, not the old dish
    setError("");
    getDish(token, itemId)
      .then((d) => { remember(memoKey, d); if (current) setData(d); })
      .catch((err) => current && setError(err.message));
    return () => { current = false; };
  }, [token, itemId, retry]);

  if (error) {
    return (
      <main className="screen kid km-screen km-screen--center">
        <BackCircle to="/kid/home" />
        <p className="km-lead" role="alert">{error}</p>
        <button type="button" className="km-big km-big--white" onClick={() => setRetry((n) => n + 1)}>Try again</button>
      </main>
    );
  }
  if (!data && state?.img && state.status && state.status !== "allowed") {
    // A blocked dish opens the locked page, not this one, so start as that page (same component, so nothing is swapped later)
    const stub = { id: Number(itemId), name: state.name, imageUrl: state.img, status: state.status, stallId: state.stallId, blockedAllergens: [] };
    return <LockedDish dish={stub} alternatives={[]} token={token} pending />;
  }
  if (!data && state?.img) {
    // The tapped card already told us the photo, name and price, so draw the real page with just those while the rest loads.
    // It is the SAME DishDetail (same key) the full data then fills in, so nothing is rebuilt mid-animation: the hero and
    // title stay put and only the missing parts appear.
    const stub = { id: Number(itemId), name: state.name, price: state.price ?? 0, imageUrl: state.img, addOns: [], safeChecks: [], ingredients: [], healthScore: null, photo: null };
    return <DishDetail key={itemId} dish={stub} canSpend={0} token={token} pending />;
  }
  if (!data) {
    return (
      <main className="screen kid km-screen km-screen--center" aria-busy="true">
        <p className="km-lead">Getting your food…</p>
      </main>
    );
  }

  if (data.dish.status !== "allowed") {
    return <LockedDish dish={data.dish} alternatives={data.alternatives} token={token} />;
  }
  // key: a different dish starts with quantity 1 and no extras
  return <DishDetail key={data.dish.id} dish={data.dish} canSpend={data.money.canSpend} token={token} />;
}

// pending: only the photo, name and price are known yet (opened from a card), so the parts that need the server stay out
function DishDetail({ dish, canSpend, token, pending = false }) {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);

  const selected = dish.addOns.filter((a) => selectedIds.includes(a.id) && !a.locked);
  const unitCents = cents(dish.price) + selected.reduce((sum, a) => sum + cents(a.extraPrice), 0);
  const totalCents = unitCents * quantity;
  // Safety rule 4: unavailable when it costs more than what's left today AFTER the food already
  // in the tray. This only helps the kid: PR B's POST /api/tray/quote re-checks the real tray
  // total on the server, and checkout checks it again.
  const tooMuch = !pending && totalCents > moneyLeftCents(canSpend, loadTray(token));

  const toggle = (id) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  function addToTray() {
    const line = {
      itemId: dish.id,
      stallId: dish.stallId,
      stallName: dish.stallName,
      name: dish.name,
      imageUrl: dish.imageUrl,
      price: dish.price,
      quantity,
      addOns: selected.map(({ id, name, extraPrice }) => ({ id, name, extraPrice })),
    };
    saveTray(token, addLine(loadTray(token), line));
    navigate(`/kid/stalls/${dish.stallId}`); // the menu's footer now shows the tray
  }

  const photo = dish.photo;
  return (
    <main className="screen kid km-screen km-screen--detail">
      <div className="km-hero" style={PHOTO_MORPH}>
        <DishPhoto src={dish.imageUrl} name={dish.name} className="km-hero__img" eager />
        <BackCircle to={`/kid/stalls/${dish.stallId}`} back className="km-hero__back" />
        {photo && photo.totalPics > 0 && (
          // Updated it to a link since i made the all pics page already - gab
          <Link to={`/kid/dishes/${dish.id}/pics`} className="km-hero__pics">
            See all {photo.totalPics} {photo.totalPics === 1 ? "pic" : "pics"}
          </Link>
        )}
        {photo && (
          <>
            <span className="km-hero__by">
              <img src={camera} width="14" height="14" alt="" /> Pic by @{photo.uploaderUsername}
            </span>
            {/* Voting is Gabriel's endpoint (not built yet), so the heart shows the count but can't be tapped */}
            <button
              type="button"
              className={`km-heart${photo.likedByMe ? " km-heart--liked" : ""}`}
              disabled
              aria-label={`${photo.hearts} hearts${photo.likedByMe ? ", you hearted this" : ""}`}
            >
              <img
                src={photo.likedByMe ? heartVoteLiked : heartVote}
                width={photo.likedByMe ? 26 : 20}
                height={photo.likedByMe ? 26 : 20}
                alt=""
              />
              {photo.hearts}
            </button>
          </>
        )}
      </div>

      <div className="km-body">
        <div className="km-row km-title-row">
          <h1 className="km-dish-name" style={NAME_MORPH}>{dish.name}</h1>
          {/* the total for what's picked: (dish + extras) x quantity */}
          <span className={`km-price-big${tooMuch ? " km-pill--muted" : ""}`} style={PRICE_MORPH} aria-live="polite">
            {formatSgd(totalCents)}
          </span>
        </div>
        {tooMuch && <span className="km-note km-note--muted km-note--self">Not enough money today</span>}
        {/* Mum's changes from her Ask Mum yes (Leslie, CB69-74): the stall gets these on the ticket */}
        {dish.askMumChanges && dish.askMumChanges.length > 0 && (
          <p className="km-mumasks">
            <span className="km-mumasks__label">Mum said yes! She asked for:</span>
            {dish.askMumChanges.map((c) => <span key={c} className="km-note km-note--mint">{c}</span>)}
          </p>
        )}

        {!pending && <section className="km-safe" aria-label="Safe for you">
          <p className="km-safe__head">
            <span className="km-safe__tick"><img src={check18} width="18" height="18" alt="" /></span>
            Safe for you!
          </p>
          {dish.safeChecks.length > 0 && (
            <div className="km-tags">
              {dish.safeChecks.map((c) => <span key={c} className="km-tag km-tag--mint">✓ {c}</span>)}
            </div>
          )}
        </section>}

        {dish.healthScore !== null && (
          <section className="km-meter" aria-label={`Healthy meter: ${dish.healthScore} out of 5`}>
            <div className="km-meter__head">
              <p className="km-h2">Healthy meter</p>
              {dish.healthScore >= 4 && <p className="km-meter__label">Great pick!</p>}
            </div>
            <div className="km-meter__leaves" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`km-leaf${n <= dish.healthScore ? " km-leaf--on" : ""}`}>
                  <img src={n <= dish.healthScore ? leafOn : leafOff} width="18" height="18" alt="" />
                </span>
              ))}
            </div>
          </section>
        )}

        {dish.ingredients.length > 0 && (
          <section aria-labelledby="km-inside">
            <h2 id="km-inside" className="km-h2">What's inside</h2>
            <div className="km-tags">
              {dish.ingredients.map((i) => <span key={i} className="km-tag km-tag--sky">{i}</span>)}
            </div>
          </section>
        )}

        <ExtrasList addOns={dish.addOns} selectedIds={selectedIds} onToggle={toggle} />
      </div>

      {!pending && <footer className="km-footer km-footer--detail">
        <div className="km-qty" role="group" aria-label="How many">
          <button type="button" onClick={() => setQuantity((q) => q - 1)} disabled={quantity <= 1} aria-label="One less">
            <img src={minus} width="20" height="20" alt="" />
          </button>
          <span className="km-qty__n" aria-live="polite">{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => q + 1)} disabled={quantity >= MAX_QTY} aria-label="One more">
            <img src={plus} width="20" height="20" alt="" />
          </button>
        </div>
        <button type="button" className="km-big km-big--sun km-big--grow" onClick={addToTray} disabled={tooMuch}>
          Add to my tray
        </button>
      </footer>}
    </main>
  );
}
