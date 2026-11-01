import type { ReactNode } from "react";

import Footer from "./Footer";

interface PublicLayoutProps {
  children: ReactNode;
  legalLinksInNewTab?: boolean;
}

// The pages outside the application shell: login, registration and, logged out, the legal pages.
function PublicLayout({ children, legalLinksInNewTab = false }: PublicLayoutProps) {
  return (
    <div className="public-layout">
      {children}
      <Footer legalLinksInNewTab={legalLinksInNewTab} />
    </div>
  );
}

export default PublicLayout;
