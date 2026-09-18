import type { ReactNode } from "react";
import Footer from "./Footer";
import Header from "./Header";

interface BaseLayoutProps {
  children: ReactNode;
}

function BaseLayout({ children }: BaseLayoutProps) {
  return (
    <div>
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

export default BaseLayout;
