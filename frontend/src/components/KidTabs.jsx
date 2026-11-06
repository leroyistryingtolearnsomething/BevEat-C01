import { Link } from "react-router-dom";
import Bao from "./Bao.jsx";

// Kid tab bar, shared by Home and Wallet; Ask Bao, Snap and Stars aren't built yet
export default function KidTabs({ active }) {
  const tab = (key) => (key === active ? { className: "hk-tab hk-tab--active", "aria-current": "page" } : { className: "hk-tab" });
  return (
    <nav className="hk-tabbar" aria-label="Main">
      <Link to="/kid/home" {...tab("home")}>
        <span className="hk-tab__icon">🏠</span>Home
      </Link>
      <button className="hk-tab">
        <span className="hk-tab__icon"><Bao size={30} /></span>Ask Bao
      </button>
      <button className="hk-tab hk-tab--snap">
        <span className="hk-tab__icon">📷</span>Snap
      </button>
      <button className="hk-tab hk-tab--locked" disabled aria-label="Stars, coming soon" title="Coming soon">
        <span className="hk-tab__icon">⭐</span>
        <span className="hk-tab__lock" aria-hidden="true">🔒</span>
        <span className="hk-tab__label">Stars</span>
      </button>
      <Link to="/kid/wallet" {...tab("wallet")}>
        <span className="hk-tab__icon">👛</span>Wallet
      </Link>
    </nav>
  );
}
