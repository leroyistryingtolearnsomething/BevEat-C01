import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession } from "../session.js";

// Kid's avatar at the top of the page: tap it for a Log out button, which asks once more before logging out
export default function KidAvatarMenu({ name, emoji }) {
  const navigate = useNavigate();
  const trigger = useRef(null);
  const menu = useRef(null);
  const confirm = useRef(null);

  // popovers open in the top layer, so pin it under the avatar each time it opens
  // (React 18 has no onToggle for popovers, so listen directly)
  useEffect(() => {
    const el = menu.current;
    const place = (e) => {
      if (e.newState !== "open") return;
      const r = trigger.current.getBoundingClientRect();
      el.style.top = `${r.bottom + 8}px`;
      el.style.left = `${r.left}px`;
    };
    el.addEventListener("toggle", place);
    return () => el.removeEventListener("toggle", place);
  }, []);

  const askToLogOut = () => {
    menu.current.hidePopover();
    confirm.current.showModal();
  };
  const logOut = () => {
    clearSession();
    navigate("/", { replace: true });
  };

  return (
    <>
      <button ref={trigger} type="button" className="hk-avatar" popovertarget="kid-menu" aria-label={`Menu for ${name}`}>
        {emoji}
      </button>
      <div ref={menu} id="kid-menu" popover="auto" className="kid-menu">
        <p className="kid-menu__name">{name}</p>
        <button type="button" className="kid-menu__item" onClick={askToLogOut}>Log out</button>
      </div>

      <dialog ref={confirm} className="confirm kw-confirm" aria-labelledby="kw-confirm-title">
        <h2 id="kw-confirm-title">Log out of KiddyEats?</h2>
        <p>You'll need your login name and PIN to come back in.</p>
        <button className="btn btn--kid" autoFocus onClick={() => confirm.current.close()}>Stay logged in</button>
        <button className="btn kw-confirm__out" onClick={logOut}>Log out</button>
      </dialog>
    </>
  );
}
