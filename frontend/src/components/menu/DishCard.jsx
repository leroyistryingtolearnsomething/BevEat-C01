import { Link } from "react-router-dom";
import DishPhoto from "./DishPhoto.jsx";
import AllergyArt from "./AllergyArt.jsx";
import { allergyNote, cardLabel } from "./dishText.js";
import heart from "../../assets/figma/menu/heart-14.svg";
import leaf from "../../assets/figma/menu/leaf-12.svg";
import lock from "../../assets/figma/menu/lock-12.svg";
import lockArt from "../../assets/figma/menu/lock-art.svg";

const BADGE_TEXT = { healthy_pick: "Healthy pick", less_sugar: "Less sugar" };

// Figma "Food Card": Status=OK, Locked (Mum says no) or Allergy. Every card links to food detail;
// for a locked dish that page shows 05 (allergy) or 05b (Mum says not today) instead of 04.
// flat = the smaller cards inside "Try these instead", which have no drop shadow in the Figma.
export default function DishCard({ dish, flat = false }) {
  const allergy = dish.status === "blocked_allergy";
  const parent = dish.status === "blocked_parent";
  const locked = allergy || parent;
  const muted = locked || dish.overBudget; // grey price pill

  const classes = ["km-card", flat && "km-card--flat", allergy && "km-card--allergy", parent && "km-card--parent"];

  return (
    <Link to={`/kid/dishes/${dish.id}`} className={classes.filter(Boolean).join(" ")} aria-label={cardLabel(dish)}>
      <div className="km-card__photo">
        <DishPhoto src={dish.imageUrl} name={dish.name} className="km-card__img" />
        {locked && <div className="km-card__overlay" aria-hidden="true" />}
        {parent && <img className="km-art km-art--lock" src={lockArt} width="144" height="112" alt="" aria-hidden="true" />}
        {allergy && <AllergyArt allergens={dish.blockedAllergens} />}
      </div>

      {/* clamped to 2 lines in CSS; title shows the full name on hover, and the card's aria-label reads it out */}
      <h3 className="km-card__name" title={dish.name}>{dish.name}</h3>

      <div className="km-card__meta">
        <span className={`km-pill km-pill--price${muted ? " km-pill--muted" : ""}`}>S${dish.price.toFixed(2)}</span>
        <span className="km-card__spacer" />
        <img src={heart} width="14" height="14" alt="" />
        <span className="km-card__hearts">
          {dish.hearts}
          <span className="sr-only"> hearts</span>
        </span>
      </div>

      {/* The note row is always there, even when empty, so every card is the same size */}
      <div className="km-card__note">
        <CardNote dish={dish} allergy={allergy} parent={parent} />
      </div>
    </Link>
  );
}

// At most one note per card, most important first
function CardNote({ dish, allergy, parent }) {
  if (allergy) return <span className="km-note km-note--allergy" title={allergyNote(dish)}>{allergyNote(dish)}</span>;
  if (parent) {
    return (
      <span className="km-note km-note--parent">
        <img src={lock} width="12" height="12" alt="" /> Mum says no
      </span>
    );
  }
  if (dish.overBudget) return <span className="km-note km-note--muted" title="Not enough money today">Not enough money today</span>;
  if (dish.askMumApproved) {
    // Mum's changes (CB69-74) show in full on the dish page; the card just hints at them
    const changes = dish.askMumChanges || [];
    const text = changes.length ? `Mum said yes · ${changes.join(", ")}` : "Mum said yes!";
    return <span className="km-note km-note--mint" title={text}>{text}</span>;
  }
  if (dish.badges.length > 0) {
    return (
      <span className="km-note km-note--mint">
        <img src={leaf} width="12" height="12" alt="" /> {BADGE_TEXT[dish.badges[0]]}
      </span>
    );
  }
  return null;
}
