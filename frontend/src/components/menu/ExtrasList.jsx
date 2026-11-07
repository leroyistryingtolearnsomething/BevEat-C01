import check from "../../assets/figma/menu/check-18.svg";
import lock from "../../assets/figma/menu/lock-12.svg";

// "Extras" on Food detail: not in the Figma, so it reuses the Sticker Pop pieces around it
// (2.5px ink border, hard shadow, pills). Each row is a real checkbox so screen readers and
// keyboards work. Locked add-ons come from the server (the child is allergic) and can't be ticked.
export default function ExtrasList({ addOns, selectedIds, onToggle }) {
  if (addOns.length === 0) return null;
  return (
    <fieldset className="km-extras">
      <legend className="km-h2">Extras</legend>
      {addOns.map((a) => {
        const selected = selectedIds.includes(a.id);
        const price = a.extraPrice > 0 ? `+S$${a.extraPrice.toFixed(2)}` : "Free";
        return (
          <label key={a.id} className={`km-extra${selected ? " km-extra--on" : ""}${a.locked ? " km-extra--locked" : ""}`}>
            <input
              type="checkbox"
              className="sr-only"
              checked={selected}
              disabled={a.locked}
              onChange={() => onToggle(a.id)}
            />
            <span className="km-extra__tick" aria-hidden="true">
              {a.locked ? <img src={lock} width="12" height="12" alt="" /> : selected && <img src={check} width="18" height="18" alt="" />}
            </span>
            <span className="km-extra__text">
              <span className="km-extra__name">{a.name}</span>
              {a.allergen && (
                <span className={`km-tag ${a.locked ? "km-tag--allergy" : "km-tag--plain"}`}>
                  {a.allergen.icon} {a.allergen.name}
                  {a.locked && <span className="sr-only">, you're allergic, so this one is off</span>}
                </span>
              )}
              {a.locked && <span className="km-extra__why">Not for you</span>}
            </span>
            <span className={`km-pill km-pill--price${a.locked ? " km-pill--muted" : ""}`}>{price}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
