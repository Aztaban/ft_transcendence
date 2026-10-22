import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";

import { AuthProvider } from "./store/AuthContext";
import { CurrentUserProvider } from "./store/CurrentUserContext";
import App from "./App";
import "./i18n";
import { RoleProvider } from "./store/RoleContext";
import { LiveProvider } from "./websocket/LiveProvider";
import "./styles/global.css";
import "./styles/ui.css";
import "./styles/layout.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LiveProvider>
          <CurrentUserProvider>
            <RoleProvider>
              <App />
            </RoleProvider>
          </CurrentUserProvider>
        </LiveProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
