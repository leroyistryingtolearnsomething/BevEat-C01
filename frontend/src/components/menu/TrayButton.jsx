import { Link } from "react-router-dom";
import { loadTray, trayBadge, trayCount } from "../../tray.js";
import "../../pages/kidMenu.css"; // the km-traybtn styles, so the page using this needn't import them

// The 🛒 at the top right of kid Home: a way into 06 My tray, with how many items are in it.
// It reads the tray when the page opens. Home is opened afresh every time the kid comes back
// to it (e.g. after adding a dish on a stall menu), so the number is always up to date.
export default function TrayButton({ token }) {
  const lines = loadTray(token);
  const badge = trayBadge(lines);
  const count = trayCount(lines);
  const label = count === 0 ? "My tray, empty" : `My tray, ${count} ${count === 1 ? "item" : "items"}`;

  return (
    <Link to="/kid/tray" className="km-traybtn" aria-label={label}>
      <span aria-hidden="true">🛒</span>
      {badge && <span className="km-traybtn__badge" aria-hidden="true">{badge}</span>}
    </Link>
  );
}
