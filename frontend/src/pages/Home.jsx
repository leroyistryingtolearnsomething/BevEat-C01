import { Link, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../session.js";
import Bao from "../components/Bao.jsx";

// Landing page after log in, until the real Home screens are built
export default function Home({ role }) {
  const navigate = useNavigate();
  const { name } = getSession();
  const kid = role === "child";
  const logOut = () => {
    clearSession();
    navigate("/", { replace: true });
  };

  return (
    <main className={`screen ${kid ? "kid" : "parent"} home`}>
      <Bao size={110} />
      <h1>Hi {name}!</h1>
      <p className="lead">You're logged in. {kid ? "Your food menu" : "Your parent Home"} comes next.</p>
      {!kid && <Link to="/parent/add-child" className="btn btn--secondary">Add a child</Link>}
      <button className={kid ? "btn btn--kid" : "btn btn--text"} onClick={logOut}>Log out</button>
    </main>
  );
}
