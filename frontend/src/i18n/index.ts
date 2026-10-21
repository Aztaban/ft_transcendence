import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import type { Language } from "../types/user";
import cs from "./locales/cs.json";
import en from "./locales/en.json";
import es from "./locales/es.json";

// The languages of the app and of the backend's messages (api-plan §5.5).
export const LANGUAGES: readonly Language[] = ["en", "cs", "es"];

// The language chosen on this device, for the pages before login. Logged in, the user's saved
// language from GET /users/me/ wins (#309).
const STORAGE_KEY = "language";

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

// The last language chosen on this device, else the browser's if we have it, else English (#310).
export function detectLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (isLanguage(saved)) {
      return saved;
    }
  } catch {
    // Storage can be blocked (private mode): fall back to the browser language.
  }

  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const match = browserLanguages.map((tag) => tag.slice(0, 2).toLowerCase()).find(isLanguage);

  return match ?? "en";
}

// Switches the app's language, remembers it on this device and tells screen readers.
export function changeLanguage(language: Language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // The choice still applies until the page is reloaded.
  }

  document.documentElement.lang = language;
  void i18n.changeLanguage(language);
}

const initialLanguage = detectLanguage();

document.documentElement.lang = initialLanguage;

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    cs: { translation: cs },
    es: { translation: es },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  // React already escapes what it renders.
  interpolation: { escapeValue: false },
});

export default i18n;
