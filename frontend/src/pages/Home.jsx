import { useEffect, useState } from "react";
import { getHome } from "../api.js";
import { clearSession, getSession } from "../session.js";
import { recall, remember } from "../memo.js";
import KidTabs from "../components/KidTabs.jsx";
import KidAvatarMenu from "../components/KidAvatarMenu.jsx";
import DishCard from "../components/menu/DishCard.jsx";
import MyOrdersCard from "../components/MyOrdersCard.jsx";
import TrayButton from "../components/menu/TrayButton.jsx";
import TransitionLink from "../components/TransitionLink.jsx";
import { Link, useNavigate } from "react-router-dom";
// Kid Home page: shows the data from GET /api/home
export default function Home() {
  const { token } = getSession();             // the logged-in kid's token
  const [home, setHome] = useState(() => recall(`${token}:home`)); // the data: last visit's copy, then the fresh one
  const [error, setError] = useState("");     // an error message, if it fails
  const [centre, setCentre] = useState(()=> recall(`${token}:centre`)); //the picked hawker centre id, null = let the backend pick the first
    const navigate = useNavigate();

  // runs when the page opens, and again when the kid picks another hawker centre: ask the backend for the data
  useEffect(() => {
    let current = true; // true while this is the newest request
    getHome(token, centre)
      .then((data) => {
        if (current) setHome(remember(`${token}:home`, data)); // success: save the data, page redraws
      })                                                        // (an out-of-date answer is ignored)
      .catch((err) => {
        if (!current) return;              // an out-of-date request failing doesn't matter any more
        if (err.status === 401) {          // login expired or invalid
          clearSession();                  // forget the old token
          navigate("/kid/login", { replace: true });
        } else {
          setError(err.message);
        }
      }); // failure: save the error, page redraws
    // cleanup: React runs this just before the effect runs again (a new centre was picked),
    // so this request is no longer the newest one and its answer will be ignored
    return () => { current = false; };
  }, [centre]); // [centre]: run when the page opens, and again every time centre changes.

  if (error) return <main className="screen kid"><p>{error}</p></main>;
  if (!home) return <main className="screen kid"><p>Loading…</p></main>;

  const { child, money, rules, pics, stalls, centres, centre: centreId, comingSoon } = home;   // pull the two parts out of the data, to save typing
// centre: centreId takes home.centre and calls it centreId
  return (
    <main className="screen kid home-kid">
            <div className="blob blob--sun" aria-hidden="true" />
      {/* Header: avatar, greeting */}
      <header className="hk-header">
        <KidAvatarMenu name={child.name} emoji={child.avatarEmoji} />
        <div>
          <h1>Hi {child.name}!</h1>
          <p className="hk-sub">What's for lunch?</p>
        </div>
        <TrayButton token={token} />
      </header>

      {/* today's orders + live queue, only shows if there are any */}
      <MyOrdersCard />

      {/* Money card: what's left today, and the meter */}
      <section className="hk-money">
        <p className="hk-money__title">My food money today</p>
        <p className="hk-money__left">
          ${money.left.toFixed(2)} <span>left</span>
        </p>
        <div className="hk-meter">
          <div className="hk-meter__fill" style={{ width: `${(money.left / money.dailyLimit) * 100}%` }} />
        </div>
        <p className="hk-money__note">
          Spent ${money.spentToday.toFixed(2)} · Daily limit ${money.dailyLimit.toFixed(2)}
        </p>
      </section>
            {/* Mum's rules: one chip per allergy */}
      <section className="hk-rules">
        <h2>Mum's rules for me</h2>
        {rules.length === 0 ? (
          <p className="hk-sub">No food rules. Enjoy!</p>
        ) : (
          <div className="hk-chips">
            {rules.map((r) => (
              <span key={r.label} className={`hk-chip hk-chip--${r.type}`}>
                {r.icon} No {r.label}
              </span>
            ))}
          </div>
        )}
      </section>
            {/* Today's yummiest pics: one card per dish, its most-voted photo */}
      <section className="hk-pics">
        <div className="hk-row-head">
          <h2>Today's yummiest pics</h2>
          <Link to="/kid/pics" className="hk-link">See all</Link>
        </div>
        {/* Raghav's Figma "Food Card", so locked and allergy dishes look the same as on the stall menu */}
        <div className="hk-pics__row">
          {pics.map((d) => (
            <div key={d.id} className="hk-pics__card"><DishCard dish={d} /></div>
          ))}
        </div>
      </section>
            {/* Stalls near you: how many dishes this kid can safely eat at each */}
      <section className="hk-stalls">
        <div className="hk-row-head">
          <h2>Stalls near you</h2>
          <span className="hk-link">📍 Map</span>
        </div>
        <select
          className ="hk-centre"
          aria-label="Hawker centre"
          value={centreId}
          onChange={(e) => setCentre(remember(`${token}:centre`,Number(e.target.value)))}>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option> //displays the options of the dropdown, displaying centre id
              // and hawker centre name
            ))}
          </select>
                {stalls.map((s) => {
          // what's inside every stall card: the picture and the text
          const inside = (
            <>
              {s.image ? (
                <img src={s.image} alt="" className="hk-stall__img" />
              ) : (
                <div className="hk-stall__img hk-stall__img--empty">🍽️</div>
              )}
              <div className="hk-stall__text">
                <h3>{s.name}</h3>
                <p className="hk-sub">{s.unit}</p>
                {comingSoon ? (
                  <p className="hk-safe hk-safe--none">Menu coming soon</p>
                ) : (
                  <p className={s.safePicks > 0 ? "hk-safe" : "hk-safe hk-safe--none"}>
                    {s.safePicks === 0
                      ? "No safe picks for you"
                      : `✓ ${s.safePicks} safe ${s.safePicks === 1 ? "pick" : "picks"} for you`}
                  </p>
                )}
              </div>
            </>
          );

          // coming soon: a plain box you can't tap. Otherwise: a link to the stall menu
          return comingSoon ? (
            <div key={s.stall} className="hk-stall hk-stall--soon" aria-disabled="true">
              <span className="hk-soon">🚧 In progress</span>
              {inside}
            </div>
          ) : (
            <TransitionLink key={s.stall} to={`/kid/stalls/${s.stall}`} className="hk-stall">
              {inside}
            </TransitionLink>
          );
        })}
      </section>
      <KidTabs active="home" />
    </main>
  );
};