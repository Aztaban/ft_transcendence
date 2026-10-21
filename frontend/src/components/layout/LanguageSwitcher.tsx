import { useTranslation } from "react-i18next";

import { updateCurrentUser } from "../../api/users";
import { changeLanguage, isLanguage, LANGUAGES } from "../../i18n";
import { useCurrentUser } from "../../store/CurrentUserContext";
import type { Language } from "../../types/user";
import "../../styles/language-switcher.css";

// EN / CS / ES in the top bar. The page switches at once; for a logged-in user the choice is also
// saved as their language (PATCH /users/me/), so it follows them to other devices (#310).
function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { user, refresh } = useCurrentUser();
  const current = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  const select = (language: Language) => {
    if (language === current) {
      return;
    }

    changeLanguage(language);

    if (user && user.language !== language) {
      updateCurrentUser({ language })
        .then(refresh)
        .catch(() => {
          // The page stays in the chosen language; the saved one is kept for the next login.
        });
    }
  };

  return (
    <div className="language-switcher" role="group" aria-label={t("language.label")}>
      {LANGUAGES.map((language) => (
        <button
          key={language}
          className="language-switcher__option"
          type="button"
          lang={language}
          aria-pressed={language === current}
          aria-label={t(`language.${language}`)}
          onClick={() => select(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
