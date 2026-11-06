import shellfishBadge from "../../assets/figma/menu/allergy-badge.svg";

const MAX_BADGES = 3;

// One round "no" badge per allergen that blocks this child, in a slightly overlapping row.
// Shellfish uses the Figma badge itself (it draws a shrimp). Every other allergen uses the same
// circle, red ring and slash drawn in CSS around its emoji. With more than 3, the 3rd badge
// becomes "+N". allergens = [] means "allergens unknown", which shows one "?" badge.
export default function AllergenBadges({ allergens, size, className = "" }) {
  const list = allergens.length > 0 ? allergens : [{ name: null, icon: "❓" }];
  const shown = list.length > MAX_BADGES ? list.slice(0, MAX_BADGES - 1) : list;
  const hidden = list.slice(shown.length);

  return (
    <span className={`km-badges ${className}`} style={{ "--km-badge": `${size}px` }}>
      {shown.map((a) => {
        const label = a.name ? `Contains ${a.name.toLowerCase()}` : "Allergens not checked yet";
        return a.name === "Shellfish" ? (
          <img key="Shellfish" className="km-badge-svg" src={shellfishBadge} width={size} height={size} alt={label} title={label} />
        ) : (
          <span key={a.name || "unknown"} className="km-badge" role="img" aria-label={label} title={label}>
            <span className="km-badge__icon" aria-hidden="true">{a.icon}</span>
          </span>
        );
      })}
      {hidden.length > 0 && (
        <span
          className="km-badge km-badge--more"
          role="img"
          aria-label={`Contains ${hidden.map((a) => a.name.toLowerCase()).join(" and ")}`}
          title={hidden.map((a) => a.name).join(", ")}
        >
          +{hidden.length}
        </span>
      )}
    </span>
  );
}
