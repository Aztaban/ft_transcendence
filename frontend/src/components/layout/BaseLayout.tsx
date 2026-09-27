import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface BaseLayoutProps {
  children: ReactNode;
}

function BaseLayout({ children }: BaseLayoutProps) {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-shell__main">
        <TopBar />
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
}

export default BaseLayout;
