import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";

import { AuthProvider } from "./store/AuthContext";
import App from "./App";
import { RoleProvider } from "./store/RoleContext";
import "./styles/global.css";
import "./styles/ui.css";
import "./styles/layout.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RoleProvider>
          <App />
        </RoleProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
