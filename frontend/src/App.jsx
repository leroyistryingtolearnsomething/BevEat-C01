import { Navigate, Route, Routes } from "react-router-dom";
import { getSession, homeFor } from "./session.js";
import Welcome from "./pages/Welcome.jsx";
import ParentLogin from "./pages/ParentLogin.jsx";
import SignUp from "./pages/SignUp.jsx";
import AddChild from "./pages/AddChild.jsx";
import KidLogin from "./pages/KidLogin.jsx";
import Home from "./pages/Home.jsx";
import ParentHome from "./pages/ParentHome.jsx";
import TopUp from "./pages/TopUp.jsx";
import ParentAllergies from "./pages/ParentAllergies.jsx";
import ParentLimit from "./pages/ParentLimit.jsx";
import ReadyPing from "./components/ReadyPing.jsx";

// UI guard only; the API checks the token's role on every request
function RequireRole({ role, children }) {
  const s = getSession();
  return s && s.role === role ? children : <Navigate to="/" replace />;
}

function LoggedOutOnly({ children }) {
  const s = getSession();
  return s ? <Navigate to={homeFor(s.role)} replace /> : children;
}

export default function App() {
  return (
    <>
    <ReadyPing />
    <Routes>
      <Route path="/" element={<LoggedOutOnly><Welcome /></LoggedOutOnly>} />
      <Route path="/parent/login" element={<LoggedOutOnly><ParentLogin /></LoggedOutOnly>} />
      <Route path="/parent/signup" element={<LoggedOutOnly><SignUp /></LoggedOutOnly>} />
      <Route path="/kid/login" element={<LoggedOutOnly><KidLogin /></LoggedOutOnly>} />
      <Route path="/parent/add-child" element={<RequireRole role="parent"><AddChild /></RequireRole>} />
      <Route path="/parent/home" element={<RequireRole role="parent"><ParentHome /></RequireRole>} />
      <Route path="/parent/allergies" element={<RequireRole role="parent"><ParentAllergies /></RequireRole>} />
      <Route path="/parent/limit" element={<RequireRole role="parent"><ParentLimit /></RequireRole>} />
      <Route path="/parent/top-up" element={<RequireRole role="parent"><TopUp /></RequireRole>} />
      <Route path="/kid/home" element={<RequireRole role="child"><Home role="child" /></RequireRole>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
