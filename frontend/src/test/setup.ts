import { afterEach } from "vitest";

import i18n from "../i18n";

// Tests read the English texts; a test that switches the language does not leak into the next.
afterEach(async () => {
  window.localStorage.removeItem("language");
  await i18n.changeLanguage("en");
});
