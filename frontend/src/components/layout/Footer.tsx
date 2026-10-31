import { useTranslation } from "react-i18next";
import { Link } from "react-router";

// The links the subject requires on every page, logged in or not.
function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="app-footer">
      <p className="app-footer__copyright">{t("legal.copyright")}</p>
      <nav className="app-footer__links" aria-label={t("legal.footerLabel")}>
        <Link to="/privacy">{t("legal.privacy.title")}</Link>
        <Link to="/terms">{t("legal.terms.title")}</Link>
      </nav>
    </footer>
  );
}

export default Footer;
