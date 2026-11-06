import { Link } from "react-router-dom";
import chevLeft from "../../assets/figma/menu/chev-left.svg";

// Figma "Back" button: 44px white circle with the chevron icon
export default function BackCircle({ to, label = "Back", className = "" }) {
  return (
    <Link to={to} className={`km-back ${className}`} aria-label={label}>
      <img src={chevLeft} width="24" height="24" alt="" />
    </Link>
  );
}
