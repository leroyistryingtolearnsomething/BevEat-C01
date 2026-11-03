import { Link } from "react-router-dom";
import Bao from "../components/Bao.jsx";
import Icon from "../components/Icon.jsx";

export default function Welcome() {
  return (
    <main className="screen kid welcome">
      <div className="blob blob--sun" aria-hidden="true" />
      <div className="blob blob--mint" aria-hidden="true" />

      <header className="welcome__brand">
        <Bao size={135} />
        <h1 className="wordmark">KiddyEats</h1>
        <p className="welcome__tagline">Hawker food your kids pick, within rules you set.</p>
      </header>

      <section className="welcome__who" aria-labelledby="who">
        <h2 id="who">Who's using KiddyEats?</h2>
        <Link to="/parent/login" className="choice choice--parent">
          <span className="choice__icon"><Icon name="users" size={28} /></span>
          <span className="choice__text">
            <strong>I'm a parent</strong>
            <span>Set limits, block foods and top up the wallet</span>
          </span>
          <Icon name="chevronRight" />
        </Link>
        <Link to="/kid/login" className="choice choice--kid">
          <span className="choice__icon"><Bao size={45} /></span>
          <span className="choice__text">
            <strong>I'm a kid</strong>
            <span>Pick your food and pay with your wallet</span>
          </span>
          <Icon name="chevronRight" />
        </Link>
      </section>

      <p className="welcome__signup">
        New here? <Link to="/parent/signup">Sign up as a parent</Link>
      </p>
    </main>
  );
}
