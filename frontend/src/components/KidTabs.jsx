import { useState } from "react";
import { Link } from "react-router-dom";
import Bao from "./Bao.jsx";
import ComingSoon from "./ComingSoon.jsx";
import homeIcon from "../assets/figma/kid/tab-home.svg";
import cameraIcon from "../assets/figma/kid/tab-camera.svg";
import starIcon from "../assets/figma/kid/tab-star.svg";
import walletIcon from "../assets/figma/kid/tab-wallet.svg";

// Kids Figma "Tab Bar" icons. Each SVG has one fixed stroke colour, so it's used as a mask and
// filled with the tab's text colour: dark on the open tab, grey on the rest.
// The quotes in url("...") matter: the production build inlines small SVGs as data URLs with ' marks.
function TabIcon({ src, size = 24 }) {
  const mask = `url("${src}")`;
  return <span className="hk-tab__svg" style={{ width: size, height: size, WebkitMaskImage: mask, maskImage: mask }} />;
}

// Kid tab bar, shared by Home and Wallet. Ask Bao and Stars aren't built yet (they look like the Figma tabs): tapping them opens a friendly "being built" card.
const SOON = {
  bao: { thing: "bubble", title: "Ask Bao is coming soon!", text: "Bao is still learning to chat. Check back soon!" },
  stars: { thing: "star", title: "Stars are being built!", text: "Bao is hard at work on them. Check back soon!" },
};

export default function KidTabs({ active }) {
  const [soon, setSoon] = useState(null); // which not-built-yet card is open
  const tab = (key) => (key === active ? { className: "hk-tab hk-tab--active", "aria-current": "page" } : { className: "hk-tab" });
  return (
    <>
    <nav className="hk-tabbar" aria-label="Main">
      <Link to="/kid/home" {...tab("home")}>
        <span className="hk-tab__icon"><TabIcon src={homeIcon} /></span>Home
      </Link>
      <button type="button" className="hk-tab" aria-haspopup="dialog" onClick={() => setSoon(SOON.bao)}>
        <span className="hk-tab__icon"><Bao size={30} /></span>Ask Bao
      </button>
      <Link to ="/kid/snap" className="hk-tab hk-tab--snap">
        <span className="hk-tab__icon"><TabIcon src={cameraIcon} size={28} /></span>Snap
      </Link>
      <button type="button" className="hk-tab" aria-haspopup="dialog" aria-label="Stars, coming soon" onClick={() => setSoon(SOON.stars)}>
        <span className="hk-tab__icon"><TabIcon src={starIcon} /></span>
        Stars
      </button>
      <Link to="/kid/wallet" {...tab("wallet")}>
        <span className="hk-tab__icon"><TabIcon src={walletIcon} /></span>Wallet
      </Link>
    </nav>
    <ComingSoon what={soon} onClose={() => setSoon(null)} />
    </>
  );
}
