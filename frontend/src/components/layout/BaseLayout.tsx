import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface BaseLayoutProps {
  children: ReactNode;
}

function BaseLayout({ children }: BaseLayoutProps) {
  const { pathname } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // On small screens the sidebar is a drawer: it closes when the page changes.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  return (
    <div className="app-shell">
      <Sidebar isOpen={isMenuOpen} />

      {isMenuOpen && (
        <div
          className="app-shell__backdrop"
          data-testid="sidebar-backdrop"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <div className="app-shell__main">
        <TopBar
          isMenuOpen={isMenuOpen}
          menuButtonRef={menuButtonRef}
          onMenuClick={() => setIsMenuOpen((open) => !open)}
        />
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
}

export default BaseLayout;
