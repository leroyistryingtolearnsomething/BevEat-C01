import { Link } from "react-router-dom";
import Bao from "./Bao.jsx";
import homeIcon from "../assets/figma/kid/tab-home.svg";
import cameraIcon from "../assets/figma/kid/tab-camera.svg";
import starIcon from "../assets/figma/kid/tab-star.svg";
import walletIcon from "../assets/figma/kid/tab-wallet.svg";
import lockIcon from "../assets/figma/menu/lock-12.svg";

// Kids Figma "Tab Bar" icons. Each SVG has one fixed stroke colour, so it's used as a mask and
// filled with the tab's text colour: dark on the open tab, grey on the rest.
// The quotes in url("...") matter: the production build inlines small SVGs as data URLs with ' marks.
function TabIcon({ src, size = 24 }) {
  const mask = `url("${src}")`;
  return <span className="hk-tab__svg" style={{ width: size, height: size, WebkitMaskImage: mask, maskImage: mask }} />;
}

// Kid tab bar, shared by Home and Wallet; Ask Bao, Snap and Stars aren't built yet
export default function KidTabs({ active }) {
  const tab = (key) => (key === active ? { className: "hk-tab hk-tab--active", "aria-current": "page" } : { className: "hk-tab" });
  return (
    <nav className="hk-tabbar" aria-label="Main">
      <Link to="/kid/home" {...tab("home")}>
        <span className="hk-tab__icon"><TabIcon src={homeIcon} /></span>Home
      </Link>
      <button className="hk-tab">
        <span className="hk-tab__icon"><Bao size={30} /></span>Ask Bao
      </button>
      <Link to ="/kid/snap" className="hk-tab hk-tab--snap">
        <span className="hk-tab__icon"><TabIcon src={cameraIcon} size={28} /></span>Snap
      </Link>
      <button className="hk-tab hk-tab--locked" disabled aria-label="Stars, coming soon" title="Coming soon">
        <span className="hk-tab__icon"><TabIcon src={starIcon} /></span>
        <span className="hk-tab__lock" aria-hidden="true"><img src={lockIcon} width="12" height="12" alt="" /></span>
        <span className="hk-tab__label">Stars</span>
      </button>
      <Link to="/kid/wallet" {...tab("wallet")}>
        <span className="hk-tab__icon"><TabIcon src={walletIcon} /></span>Wallet
      </Link>
    </nav>
  );
}
