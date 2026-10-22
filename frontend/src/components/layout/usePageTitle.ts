import { useEffect } from "react";

const APP_NAME = "42 Evals";

// Names the page in the browser tab, e.g. "History · 42 Evals", so screen readers and the tab
// list say where the user is (WCAG 2.4.2). Pass translated text: the title follows a language
// switch because the page renders again with the new text.
function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}

export default usePageTitle;
