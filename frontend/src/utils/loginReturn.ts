// The page to open after logging in with 42 (#328). The 42 login leaves the app, so the page the
// login gate remembered is lost on the way; the backend then always sends the browser to "/"
// (api-plan §10.1). The Login page keeps that page here for this tab, and the app opens it once
// the user is back and logged in. Storage can be unavailable (private mode, blocked site data),
// so every access is guarded: the user then simply lands on Home.
const KEY = "login-return-to";

// Only paths inside the app, e.g. "/history?status=cancelled", never "//other.site" or a full URL.
export function isAppPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/\\")
  );
}

export function rememberReturnPath(path: string) {
  try {
    if (isAppPath(path) && path !== "/") {
      sessionStorage.setItem(KEY, path);
    } else {
      sessionStorage.removeItem(KEY);
    }
  } catch {
    // Without storage the user lands on Home after the 42 login.
  }
}

// Reads the remembered page once: it is removed, so a later visit to Home stays on Home.
export function takeReturnPath(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);

    sessionStorage.removeItem(KEY);

    return isAppPath(path) ? path : null;
  } catch {
    return null;
  }
}
