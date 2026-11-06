import triangle from "../../assets/figma/menu/allergy-triangle.svg";
import AllergenBadges from "./AllergenBadges.jsx";

const FIGMA_BADGE = 32.5; // badge size in the Figma "Allergy art"

// Figma "Allergy art" (Food Card, Status=Allergy): a red warning triangle plus round "no" badges,
// one per allergen that blocks this child (see AllergenBadges).
export default function AllergyArt({ allergens }) {
  return (
    <div className="km-art">
      <img className="km-art__triangle" src={triangle} width="68.8" height="59.2" alt="" aria-hidden="true" />
      <AllergenBadges allergens={allergens} size={FIGMA_BADGE} className="km-art__badges" />
    </div>
  );
}
