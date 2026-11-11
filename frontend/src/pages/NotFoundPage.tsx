import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import usePageTitle from "../components/layout/usePageTitle";
import "../styles/not-found.css";

// An unknown address: the same page layout as the others, and a way back (#373, #374).
function NotFoundPage() {
  const { t } = useTranslation();

  usePageTitle(t("pageTitle.notFound"));

  return (
    <section className="not-found">
      <h1>404</h1>
      <p>{t("notFound.text")}</p>
      <Link className="not-found__home" to="/">
        <span aria-hidden="true">‹</span> {t("common.backToHome")}
      </Link>
    </section>
  );
}

export default NotFoundPage;
