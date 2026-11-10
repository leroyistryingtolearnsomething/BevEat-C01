import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";
import "./macros.css";
import "./glass.css";
import "./kidOrderDone.css";
import "./kidMotion.css";
import { installGlassDrag } from "./glassDrag.js";
import { installGlassGlow } from "./glassGlow.js";

installGlassDrag();
installGlassGlow();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
