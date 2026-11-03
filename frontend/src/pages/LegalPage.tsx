import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import logo42 from "../assets/figma/42.svg";
import LanguageSwitcher from "../components/layout/LanguageSwitcher";
import { dateLocale } from "../i18n";
import "../styles/registration.css";
import "../styles/legal.css";

export type LegalDocument = "privacy" | "terms";

interface LegalSection {
  title: string;
  text: string[];
  items?: string[];
}

// Change a date whenever the texts of that document change in the locale files.
const LAST_UPDATED: Record<LegalDocument, string> = {
  privacy: "2026-11-01",
  terms: "2026-11-01",
};

interface LegalPageProps {
  kind: LegalDocument;
  // Logged out there is no application shell, so the page brings its own logo, language switcher
  // and way back. The "/" link leads a logged-out visitor to the login page.
  standalone?: boolean;
}

// Privacy Policy and Terms of Service, required by the subject. They are public: a visitor reads
// them before creating an account. The sections live in the locale files.
function LegalPage({ kind, standalone = false }: LegalPageProps) {
  const { t } = useTranslation();
  const sections = t(`legal.${kind}.sections`, { returnObjects: true }) as LegalSection[];
  const lastUpdated = new Intl.DateTimeFormat(dateLocale(), {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(LAST_UPDATED[kind]));

  // A footer link is at the bottom of the page it leaves: this one opens at its title.
  useEffect(() => {
    document.documentElement.scrollTop = 0;
  }, [kind]);

  const article = (
    <article className="legal-page__article">
      {standalone && (
        <Link className="legal-page__brand" to="/">
          <img src={logo42} alt="42" />
          <span>EVALS</span>
        </Link>
      )}

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

      {standalone && (
        <Link className="legal-page__back" to="/">
          <span aria-hidden="true">←</span> {t("legal.back")}
        </Link>
      )}
    </article>
  );

  if (!standalone) {
    return article;
  }

  return (
    <main className="legal-page">
      <div className="registration-page__language">
        <LanguageSwitcher />
      </div>

      {article}
    </main>
  );
}

export default LegalPage;
