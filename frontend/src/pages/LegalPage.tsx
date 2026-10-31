import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import logo42 from "../assets/figma/42.svg";
import LanguageSwitcher from "../components/layout/LanguageSwitcher";
import { dateLocale } from "../i18n";
import "../styles/legal.css";

type LegalDocument = "privacy" | "terms";

interface LegalSection {
  title: string;
  text: string[];
  items?: string[];
}

// Change it whenever the texts of `legal.privacy` or `legal.terms` change.
const LAST_UPDATED = "2026-10-31";

interface LegalPageProps {
  kind: LegalDocument;
}

// Privacy Policy and Terms of Service, required by the subject. They are public: a visitor reads
// them before creating an account. The sections live in the locale files, and the "/" link leads
// a logged-out visitor to the login page.
function LegalPage({ kind }: LegalPageProps) {
  const { t } = useTranslation();
  const sections = t(`legal.${kind}.sections`, { returnObjects: true }) as LegalSection[];
  const lastUpdated = new Intl.DateTimeFormat(dateLocale(), {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(LAST_UPDATED));

  return (
    <main className="legal-page">
      <div className="legal-page__language">
        <LanguageSwitcher />
      </div>

      <article className="legal-page__article">
        <Link className="legal-page__brand" to="/" aria-label={t("legal.back")}>
          <img src={logo42} alt="" aria-hidden="true" />
          <span>EVALS</span>
        </Link>

        <h1>{t(`legal.${kind}.title`)}</h1>
        <p className="legal-page__updated">{t("legal.lastUpdated", { date: lastUpdated })}</p>
        <p className="legal-page__intro">{t(`legal.${kind}.intro`)}</p>

        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.text.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items && (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <Link className="legal-page__back" to="/">
          <span aria-hidden="true">←</span> {t("legal.back")}
        </Link>
      </article>
    </main>
  );
}

export default LegalPage;
