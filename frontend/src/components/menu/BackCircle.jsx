import { Link, useLocation, useNavigate } from "react-router-dom";
import chevLeft from "../../assets/figma/menu/chev-left.svg";

// Go back to the page the kid came from (Home, See all, a stall...).
// If this page was opened directly (a refresh or a shared link) there's no page to go back to,
// so go to `fallback` instead.
export function useGoBack(fallback) {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => (key === "default" ? navigate(fallback, { replace: true }) : navigate(-1));
}

// Figma "Back" button: 44px white circle with the chevron icon.
// `to` always goes to that page; `back` goes to the previous page (falling back to `to`).
export default function BackCircle({ to, back = false, label = "Back", className = "" }) {
  const goBack = useGoBack(to);
  const icon = <img src={chevLeft} width="24" height="24" alt="" />;
  if (back)
    return (
      <button type="button" onClick={goBack} className={`km-back ${className}`} aria-label={label}>
        {icon}
      </button>
    );
  return (
    <Link to={to} className={`km-back ${className}`} aria-label={label}>
      {icon}
    </Link>
  );
}
