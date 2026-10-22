import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface BaseLayoutProps {
  children: ReactNode;
}

function BaseLayout({ children }: BaseLayoutProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

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
      {/* The first Tab stop: jumps over the menu to the page itself (WCAG 2.4.1). Hidden until
          it has the focus. Focusing <main> directly keeps the URL free of "#main-content". */}
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        {t("nav.skipToContent")}
      </a>

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
        <main ref={mainRef} id="main-content" className="app-shell__content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default BaseLayout;
