import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../session.js";
import { KidSwitcher, ParentTabs, money, useKids } from "../components/ParentShell.jsx";
import ParentAlerts from "../components/ParentAlerts.jsx";
import ParentOrdersCard from "../components/ParentOrdersCard.jsx";
import { AskMumBell, AskMumPings, useAskMumPending } from "../components/AskMum.jsx";
import Icon from "../components/Icon.jsx";
import TransitionLink from "../components/TransitionLink.jsx";
import walletIcon from "../assets/figma/wallet.svg";
import warningIcon from "../assets/figma/warning.svg";
import plusGreen from "../assets/figma/plus-green.svg";
import plusWhite from "../assets/figma/plus-white.svg";

// Parent home: today's food money, wallet, and the selected kid's allergies or limit
export default function ParentHome() {
  const navigate = useNavigate();
  const { name } = getSession();
  const { kids, kid, select, error, token } = useKids();
  const [section, setSection] = useState("allergies");
  const [lowWallets, setLowWallets] = useState(null); // low_wallet alerts, null until loaded
  const askMum = useAskMumPending(token); // Ask Mum requests waiting for an answer (Leslie, CB69-26)

  const logOut = () => {
    clearSession();
    navigate("/", { replace: true });
  };

  return (
    <main className="screen parent with-tabs">
      <header className="hello">
        <AccountMenu name={name} onLogOut={logOut} />
        <div>
          <h1>Hi {name}!</h1>
          <p className="lead">Your kids' limits for today</p>
        </div>
        <AskMumBell requests={askMum} />
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}
      {!kids && !error && <p className="lead">Loading…</p>}
      {kids?.length === 0 && (
        <div className="stack">
          <p className="lead">Add your child to set their food money and allergies.</p>
          <Link to="/parent/add-child" className="btn btn--primary"><Icon name="plus" size={20} /> Add a child</Link>
        </div>
      )}

      {kid && (
        <>
          <KidSwitcher kids={kids} kid={kid} onSelect={select} />
          <AskMumPings requests={askMum} />
          <ParentAlerts token={token} onLowWallets={setLowWallets} />
          <ParentOrdersCard token={token} />
          <Today kid={kid} lowAlert={lowWallets?.find((a) => a.childId === kid.id)} alertsLoaded={!!lowWallets} />
          <TransitionLink to={`/parent/macros?kid=${kid.id}`} className="m-home-link">
            <span>{kid.name}'s food and nutrients</span>
            <span aria-hidden="true">›</span>
          </TransitionLink>

          <div className="seg" role="group" aria-label="Show">
            {[["allergies", "Allergies"], ["limit", "Daily limit"]].map(([key, label]) => (
              <button key={key} type="button" aria-pressed={section === key} onClick={() => setSection(key)}>{label}</button>
            ))}
          </div>

          {section === "allergies" ? (
            <section>
              <div className="section-head">
                <h2>{kid.name}'s allergies</h2>
                <Link to={`/parent/allergies?kid=${kid.id}`} className="edit-link">Edit</Link>
              </div>
              {kid.allergens.length ? (
                <ul className="tags">
                  {kid.allergens.map((a) => <li key={a} className="tag">No {a}</li>)}
                </ul>
              ) : (
                <p className="lead">No allergies set. Every dish shows up for {kid.name}.</p>
              )}
            </section>
          ) : (
            <section>
              <div className="section-head">
                <h2>{kid.name}'s daily limit</h2>
                {/* the green "food money today" card grows into the limit page's green card */}
                <TransitionLink to={`/parent/limit?kid=${kid.id}`} scope="page" shared={{ ".today": "parent-hero" }} className="edit-link">Edit</TransitionLink>
              </div>
              <p className="lead">{kid.name} can spend up to {money(kid.dailyLimit)} a day. It resets at 12:00 am.</p>
            </section>
          )}

          <div className="p-links">
            <Link to={`/parent/spending?kid=${kid.id}`} className="btn btn--secondary">Spending report</Link>
            <Link to={`/parent/pin?kid=${kid.id}`} className="btn btn--secondary">Reset PIN</Link>
          </div>
        </>
      )}

      <ParentTabs active="home" kidId={kid?.id} />
    </main>
  );
}

// Account actions live behind the avatar, away from the daily content, like most phone apps
function AccountMenu({ name, onLogOut }) {
  const trigger = useRef(null);
  const menu = useRef(null);

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

  return (
    <>
      <button ref={trigger} type="button" className="hello__avatar" popovertarget="account-menu"
        aria-label={`Account menu for ${name}`}>
        {name[0]?.toUpperCase()}
        <span className="hello__caret"><Icon name="chevronDown" size={12} strokeWidth={3} /></span>
      </button>
      <div ref={menu} id="account-menu" popover="auto" className="account-menu">
        <p className="account-menu__name">{name}</p>
        <p className="account-menu__role">Parent account</p>
        <Link to="/parent/add-child" className="account-menu__item"><Icon name="plus" size={20} />Add a child</Link>
        <button type="button" className="account-menu__item" onClick={onLogOut}><Icon name="logOut" size={20} />Log out</button>
      </div>
    </>
  );
}

function Today({ kid, lowAlert, alertsLoaded }) {
  const limit = kid.todayLimit ?? kid.dailyLimit; // today's weekday limit if there is one
  const left = Math.max(0, limit - kid.spentToday);
  const spentPct = limit ? Math.min(100, (kid.spentToday / limit) * 100) : 0;
  // alerts know the amount the parent picked, until they load use one day's limit
  const low = alertsLoaded ? !!lowAlert : kid.walletBalance < kid.dailyLimit;
  const topUp = `/parent/top-up?kid=${kid.id}`;

  return (
    <section className="today" aria-label={`${kid.name}'s food money today`}>
      <p className="today__title">{kid.name}'s food money today</p>
      <p className="today__left"><strong>{money(left)}</strong> left</p>
      <div className="today__bar" role="progressbar" aria-label="Spent today" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spentPct)}>
        <span style={{ width: `${spentPct}%` }} />
      </div>
      <p className="today__meta">Spent {money(kid.spentToday)} · {limit === kid.dailyLimit ? "Daily limit" : "Today's limit"} {money(limit)}</p>

      {low ? (
        <div className="wallet wallet--low">
          <img src={warningIcon} alt="" width="22" height="22" />
          <div className="wallet__text">
            <p className="wallet__strong">Wallet low: {money(kid.walletBalance)}</p>
            <p className="wallet__small">
              {lowAlert?.picked ? `Under the ${money(lowAlert.alertBelow)} you picked` : `Under tomorrow's ${money(kid.dailyLimit)} limit`}
            </p>
          </div>
          <TransitionLink to={topUp} scope="page" shared={{ ".wallet": "parent-wallet" }} className="wallet__btn wallet__btn--dark"><img src={plusWhite} alt="" width="16" height="16" />Top up</TransitionLink>
        </div>
      ) : (
        <div className="wallet">
          <img src={walletIcon} alt="" width="22" height="22" />
          <div className="wallet__text">
            <p className="wallet__small">In {kid.name}'s wallet</p>
            <p className="wallet__big">{money(kid.walletBalance)}</p>
          </div>
          <TransitionLink to={topUp} scope="page" shared={{ ".wallet": "parent-wallet" }} className="wallet__btn"><img src={plusGreen} alt="" width="16" height="16" />Top up</TransitionLink>
        </div>
      )}
    </section>
  );
}
