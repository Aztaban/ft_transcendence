import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import logo42 from "../assets/figma/42.svg";
import BackLink from "../components/layout/BackLink";
import LanguageSwitcher from "../components/layout/LanguageSwitcher";
import type { LegalDocument } from "../components/layout/legalPages";
import usePageTitle from "../components/layout/usePageTitle";
import { dateLocale } from "../i18n";
import "../styles/registration.css";
import "../styles/legal.css";

// A section has a title and paragraphs, a list, or both.
interface LegalSection {
  title: string;
  text?: string[];
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
  usePageTitle(t(`legal.${kind}.title`));
  // A locale file without sections shows the title and intro instead of a blank page.
  const loaded = t(`legal.${kind}.sections`, { returnObjects: true });
  const sections: LegalSection[] = Array.isArray(loaded) ? loaded : [];
  const lastUpdated = new Intl.DateTimeFormat(dateLocale(), {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(LAST_UPDATED[kind]));

  const article = (
    <article className="legal-page__article">
      {standalone && (
        <Link className="legal-page__brand" to="/">
          <img src={logo42} alt="42" />
          <span>EVALS</span>
        </Link>
      )}

      {/* Inside the app: back to the page the user came from, like the other pages (#374). */}
      {!standalone && <BackLink className="legal-page__return" />}

      <h1>{t(`legal.${kind}.title`)}</h1>
      <p className="legal-page__updated">{t("legal.lastUpdated", { date: lastUpdated })}</p>
      <p className="legal-page__intro">{t(`legal.${kind}.intro`)}</p>

      {/* The texts are static, so the index is a stable key, and two identical lines in a
          translation cannot cause a duplicate-key warning. */}
      {sections.map((section, sectionIndex) => (
        <section key={sectionIndex}>
          <h2>{section.title}</h2>
          {section.text?.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          {section.items && (
            <ul>
              {section.items.map((item, index) => (
                <li key={index}>{item}</li>
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
