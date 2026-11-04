import { afterEach, describe, expect, test, vi } from "vitest";

import i18n, { changeLanguage, detectLanguage } from ".";
import cs from "./locales/cs.json";
import en from "./locales/en.json";
import es from "./locales/es.json";

afterEach(() => {
  vi.restoreAllMocks();
});

// Every text path of a locale file, e.g. "nav.home". Plural forms count once: Czech has more of
// them than English ("time.days_one", "time.days_few", …).
function keys(texts: object, prefix = ""): string[] {
  const paths = Object.entries(texts).flatMap(([key, value]) =>
    typeof value === "object"
      ? keys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`.replace(/_(one|few|many|other)$/, "")],
  );

  return [...new Set(paths)];
}

// The plural forms of each text with a count, e.g. "time.days" → ["few", "one", "other"].
function pluralTexts(texts: object, prefix = ""): Map<string, string[]> {
  const found = new Map<string, string[]>();

  for (const [key, value] of Object.entries(texts)) {
    if (typeof value === "object") {
      for (const [path, forms] of pluralTexts(value, `${prefix}${key}.`)) {
        found.set(path, forms);
      }
    } else {
      const match = /^(.*)_(one|few|many|other)$/.exec(key);

      if (match) {
        const path = `${prefix}${match[1]}`;
        found.set(path, [...(found.get(path) ?? []), match[2]]);
      }
    }
  }

  return found;
}

// The forms a language uses for whole numbers: Czech one/few/other, English and Spanish
// one/other. ("many" is for decimals in Czech and for millions in Spanish.)
function wholeNumberForms(language: string) {
  const rules = new Intl.PluralRules(language);

  return [...new Set(Array.from({ length: 200 }, (_, count) => rules.select(count)))].sort();
}

describe("locale files", () => {
  test("Czech and Spanish have exactly the English keys", () => {
    expect(keys(cs)).toEqual(keys(en));
    expect(keys(es)).toEqual(keys(en));
  });

  test.each([
    ["en", en],
    ["cs", cs],
    ["es", es],
  ])("every text with a count has the %s plural forms", (language, texts) => {
    const forms = wholeNumberForms(language);
    const missing = [...pluralTexts(texts)]
      .filter(([, found]) => forms.some((form) => !found.includes(form)))
      .map(([path]) => path);

    expect(missing).toEqual([]);
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

describe("plural forms", () => {
  test("follow each language's rules", async () => {
    expect([1, 2, 5].map((count) => i18n.t("time.days", { count }))).toEqual([
      "1 day",
      "2 days",
      "5 days",
    ]);

    await i18n.changeLanguage("cs");

    expect([1, 2, 5].map((count) => i18n.t("time.days", { count }))).toEqual([
      "1 den",
      "2 dny",
      "5 dní",
    ]);
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
