import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { LEGAL_PAGES } from "./legalPages";

interface FooterProps {
  // On Login and Register: leaving in the same tab would lose the form and the page to return to.
  legalLinksInNewTab?: boolean;
}

// The links the subject requires on every page, logged in or not.
function Footer({ legalLinksInNewTab = false }: FooterProps) {
  const { t } = useTranslation();

  return (
    <footer className="app-footer">
      <p className="app-footer__copyright">
        {t("legal.copyright", { year: new Date().getFullYear() })}
      </p>
      <nav className="app-footer__links" aria-label={t("legal.footerLabel")}>
        {LEGAL_PAGES.map((page) => (
          <Link
            key={page.path}
            to={page.path}
            {...(legalLinksInNewTab && {
              target: "_blank",
              rel: "noreferrer",
              "aria-label": `${t(page.titleKey)} (${t("legal.opensInNewTab")})`,
            })}
          >
            {t(page.titleKey)}
          </Link>
        ))}
      </nav>
    </footer>
  );
}

export default Footer;
