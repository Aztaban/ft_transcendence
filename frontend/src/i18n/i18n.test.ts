import { afterEach, describe, expect, test, vi } from "vitest";

import i18n, { changeLanguage, detectLanguage } from ".";
import cs from "./locales/cs.json";
import en from "./locales/en.json";
import es from "./locales/es.json";

afterEach(() => {
  vi.restoreAllMocks();
});

// i18next plural endings. Each language has its own set: Czech needs "_few", English does not.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

// Every text path of a locale file, e.g. "nav.home". The plural variants of a text count as one
// path, e.g. "topbar.notificationsUnread" for its "_one", "_few" and "_other" variants.
function keys(texts: object, prefix = ""): string[] {
  const paths = Object.entries(texts).flatMap(([key, value]) =>
    typeof value === "object"
      ? keys(value, `${prefix}${key}.`)
      : [`${prefix}${key.replace(PLURAL_SUFFIX, "")}`],
  );

  return [...new Set(paths)];
}

describe("locale files", () => {
  test("Czech and Spanish have exactly the English keys", () => {
    expect(keys(cs)).toEqual(keys(en));
    expect(keys(es)).toEqual(keys(en));
  });
});

describe("detectLanguage", () => {
  test("prefers the language chosen on this device", () => {
    window.localStorage.setItem("language", "es");
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["cs-CZ"]);

    expect(detectLanguage()).toBe("es");
  });

  test("ignores an unknown saved value and uses the browser language", () => {
    window.localStorage.setItem("language", "de");
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["de-DE", "cs-CZ", "en"]);

    expect(detectLanguage()).toBe("cs");
  });

  test("falls back to English", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["de-DE", "fr"]);

    expect(detectLanguage()).toBe("en");
  });

  test("still works when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["es-ES"]);

    expect(detectLanguage()).toBe("es");
  });
});

describe("changeLanguage", () => {
  test("switches the texts, remembers the choice and sets the page language", () => {
    changeLanguage("cs");

    expect(i18n.t("language.label")).toBe("Jazyk");
    expect(window.localStorage.getItem("language")).toBe("cs");
    expect(document.documentElement.lang).toBe("cs");
  });
});
