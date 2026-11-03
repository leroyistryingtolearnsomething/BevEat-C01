import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

export default function BackButton({ to, label = "Back" }) {
  return (
    <Link to={to} className="back" aria-label={label}>
      <Icon name="chevronLeft" size={22} />
    </Link>
  );
}
