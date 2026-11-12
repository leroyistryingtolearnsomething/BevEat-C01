import { Navigate, Route, Routes } from "react-router-dom";
import { getSession, homeFor } from "./session.js";
import Welcome from "./pages/Welcome.jsx";
import ParentLogin from "./pages/ParentLogin.jsx";
import SignUp from "./pages/SignUp.jsx";
import AddChild from "./pages/AddChild.jsx";
import KidLogin from "./pages/KidLogin.jsx";
import KidWallet from "./pages/KidWallet.jsx";
import KidPics from "./pages/KidPics.jsx";
import Home from "./pages/Home.jsx";
import ParentHome from "./pages/ParentHome.jsx";
import TopUp from "./pages/TopUp.jsx";
import ParentAllergies from "./pages/ParentAllergies.jsx";
import ParentLimit from "./pages/ParentLimit.jsx";
import ParentMenu from "./pages/ParentMenu.jsx";
import StallMenu from "./pages/StallMenu.jsx";
import FoodDetail from "./pages/FoodDetail.jsx";
import Tray from "./pages/Tray.jsx";
import KidPickup from "./pages/KidPickup.jsx";
import KidOrderDone from "./pages/KidOrderDone.jsx";
import ParentSpending from "./pages/ParentSpending.jsx";
import ParentPin from "./pages/ParentPin.jsx";
import ParentAskMum from "./pages/ParentAskMum.jsx";
import ParentMacros from "./pages/ParentMacros.jsx";
import ParentOrders from "./pages/ParentOrders.jsx";
import ReadyPing from "./components/ReadyPing.jsx";
import Snap from "./pages/Snap.jsx"

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
      <Route path="/parent/menu" element={<RequireRole role="parent"><ParentMenu /></RequireRole>} />
      <Route path="/parent/spending" element={<RequireRole role="parent"><ParentSpending /></RequireRole>} />
      <Route path="/parent/pin" element={<RequireRole role="parent"><ParentPin /></RequireRole>} />
      <Route path="/parent/ask-mum/:requestId" element={<RequireRole role="parent"><ParentAskMum /></RequireRole>} />
      <Route path="/kid/order-done" element={<RequireRole role="child"><KidOrderDone /></RequireRole>} />
      <Route path="/kid/pickup/:orderId" element={<RequireRole role="child"><KidPickup /></RequireRole>} />
      <Route path="/parent/macros" element={<RequireRole role="parent"><ParentMacros /></RequireRole>} />
      <Route path="/parent/orders" element={<RequireRole role="parent"><ParentOrders /></RequireRole>} />
      <Route path="/parent/top-up" element={<RequireRole role="parent"><TopUp /></RequireRole>} />
      <Route path="/kid/home" element={<RequireRole role="child"><Home role="child" /></RequireRole>} />
      <Route path="/kid/wallet" element={<RequireRole role="child"><KidWallet /></RequireRole>} />
      <Route path="/kid/pics" element={<RequireRole role="child"><KidPics /></RequireRole>} />
      <Route path="/kid/snap" element={<RequireRole role ="child"><Snap/></RequireRole>} />
      <Route path="/kid/stalls/:stallId" element={<RequireRole role="child"><StallMenu /></RequireRole>} />
      <Route path="/kid/dishes/:itemId" element={<RequireRole role="child"><FoodDetail /></RequireRole>} />
      <Route path="/kid/tray" element={<RequireRole role="child"><Tray /></RequireRole>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
