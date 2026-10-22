import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useRole } from "../store/RoleContext";
import "../styles/unauthorized.css";

function UnauthorizedPage() {
  const { t } = useTranslation();
  const { activeRole } = useRole();

  return (
    <section className="unauthorized-page">
      <div className="unauthorized-page__code">403</div>

      <div className="unauthorized-page__content">
        <p className="unauthorized-page__eyebrow">{t("unauthorized.eyebrow")}</p>
        <h1>{t("unauthorized.title")}</h1>
        <p>
          <Trans
            i18nKey="unauthorized.text"
            values={{ role: t(`workspace.${activeRole}`) }}
            components={{ strong: <strong /> }}
          />
        </p>

        <Link className="unauthorized-page__action" to="/">
          {t("unauthorized.back")}
        </Link>
      </div>
    </section>
  );
}

export default UnauthorizedPage;
