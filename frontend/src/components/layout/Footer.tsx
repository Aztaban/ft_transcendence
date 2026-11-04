import { useTranslation } from "react-i18next";
import { Link } from "react-router";

const legalPages = [
  { to: "/privacy", label: "legal.privacy.title" },
  { to: "/terms", label: "legal.terms.title" },
];

interface FooterProps {
  // On Login and Register: leaving in the same tab would lose the form and the page to return to.
  legalLinksInNewTab?: boolean;
}

// The links the subject requires on every page, logged in or not.
function Footer({ legalLinksInNewTab = false }: FooterProps) {
  const { t } = useTranslation();

  return (
    <footer className="app-footer">
      <p className="app-footer__copyright">{t("legal.copyright")}</p>
      <nav className="app-footer__links" aria-label={t("legal.footerLabel")}>
        {legalPages.map((page) =>
          legalLinksInNewTab ? (
            <Link
              key={page.to}
              to={page.to}
              target="_blank"
              rel="noreferrer"
              aria-label={`${t(page.label)} (${t("legal.opensInNewTab")})`}
            >
              {t(page.label)}
            </Link>
          ) : (
            <Link key={page.to} to={page.to}>
              {t(page.label)}
            </Link>
          ),
        )}
      </nav>
    </footer>
  );
}

export default Footer;
