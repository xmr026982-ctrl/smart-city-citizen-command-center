import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

/* original desk styles */
import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/dashboard.css";
import "./styles/animations.css";
import "./styles/help.css";

/* Issue Management styles (all scoped to .ix) */
import "./styles/issue-theme.css";
import "./styles/holographic.css";
import "./styles/forms.css";
import "./styles/tables.css";
import "./styles/issue.css";
import "./styles/nexus.css";
import "./styles/responsive.css";

import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);