import type { ReactNode } from "react";

import Footer from "./Footer";

interface PublicLayoutProps {
  children: ReactNode;
}

// The pages outside the application shell: login, registration and the legal pages.
function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="public-layout">
      {children}
      <Footer />
    </div>
  );
}

export default PublicLayout;
