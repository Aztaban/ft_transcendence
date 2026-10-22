import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";

import logo42 from "../assets/figma/42.svg";
import { ApiError } from "../api/client";
import LanguageSwitcher from "../components/layout/LanguageSwitcher";
import { Button, Input } from "../components/ui";
import { useAuth } from "../store/AuthContext";
import { rememberReturnPath, takeReturnPath } from "../utils/loginReturn";
import "../styles/registration.css";

const OAUTH_42_REDIRECT_URL = "/api/v1/auth/42/redirect/";

// `?oauth=` code from the 42 login (api-plan §10.1) → key of the "auth" texts.
const OAUTH_ERROR_KEYS: Record<string, string> = {
  oauth_not_configured: "auth.oauthNotConfigured",
  oauth_invalid_state: "auth.oauthInvalidState",
  oauth_missing_code: "auth.oauthMissingCode",
  oauth_token_exchange_failed: "auth.oauthTokenExchangeFailed",
  oauth_profile_retrieval_failed: "auth.oauthProfileRetrievalFailed",
  oauth_access_denied: "auth.oauthAccessDenied",
  oauth_provider_error: "auth.oauthProviderError",
  oauth_account_suspended: "auth.oauthAccountSuspended",
  oauth_account_exists: "auth.oauthAccountExists",
  oauth_identity_conflict: "auth.oauthIdentityConflict",
  oauth_account_conflict: "auth.oauthAccountConflict",
};

function getOAuthErrorKey(code: string | null) {
  if (!code) {
    return "";
  }

  // Own keys only: `?oauth=toString` must not find the object's built-in properties.
  return Object.prototype.hasOwnProperty.call(OAUTH_ERROR_KEYS, code)
    ? OAUTH_ERROR_KEYS[code]
    : "auth.oauthFailed";
}

// `registeredEmail`: set by RegisterPage after a successful registration (#522).
// `from`: the page the login gate sent the user away from (#328).
interface LoginLocationState {
  registeredEmail?: string;
  from?: { pathname: string; search?: string; hash?: string };
}

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const registeredEmail = (location.state as LoginLocationState | null)?.registeredEmail;
  const from = (location.state as LoginLocationState | null)?.from;
  const afterLogin = from ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}` : "/";
  const [searchParams, setSearchParams] = useSearchParams();
  const { login } = useAuth();

  // Our own messages are kept as keys, so they follow a language switch; a message from the
  // backend is already in the language it was asked in (api-plan §5.5).
  const [errorKey, setErrorKey] = useState(() => getOAuthErrorKey(searchParams.get("oauth")));
  const [serverError, setServerError] = useState("");
  const error = errorKey ? t(errorKey) : serverError;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRegistered, setShowRegistered] = useState(Boolean(registeredEmail));

  // Drop ?oauth= once the message is in state so a reload does not show it again.
  useEffect(() => {
    if (searchParams.has("oauth")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("oauth");
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    setErrorKey("");
    setServerError("");
    setShowRegistered(false);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      // A failed 42 login comes back here without the gate's page; the one kept for it applies.
      const keptForOAuth = takeReturnPath();

      navigate(from ? afterLogin : (keptForOAuth ?? "/"), { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === "invalid_credentials") {
        setErrorKey("auth.invalidCredentials");
      } else if (error instanceof ApiError) {
        setServerError(error.message);
      } else {
        setErrorKey("auth.loginError");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="registration-page">
      <div className="registration-page__language">
        <LanguageSwitcher />
      </div>

      <div className="registration-panel">
        <div className="registration-brand">
          <img src={logo42} alt="42" />
          <span>EVALS</span>
        </div>

        <div className="registration-brand__accent" />

        <form className="registration-form" onSubmit={handleSubmit}>
          <Input
            id="login-email"
            name="email"
            type="email"
            placeholder={t("auth.email")}
            aria-label={t("auth.email")}
            autoComplete="email"
            defaultValue={registeredEmail}
            required
          />

          <Input
            id="login-password"
            name="password"
            type="password"
            placeholder={t("auth.password")}
            aria-label={t("auth.password")}
            autoComplete="current-password"
            required
          />

          {showRegistered && (
            <p
              className="registration-form__message registration-form__message--success"
              role="status"
            >
              {t("auth.registered")}
            </p>
          )}

          {error && (
            <p
              className="registration-form__message registration-form__message--error"
              role="alert"
            >
              {error}
            </p>
          )}

          <Button className="registration-form__submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("auth.loggingIn") : t("auth.login")}
          </Button>
        </form>

        <div className="registration-divider">
          <span>{t("auth.or")}</span>
        </div>

        <a
          className="ui-button ui-button--secondary registration-oauth"
          href={OAUTH_42_REDIRECT_URL}
          onClick={() => rememberReturnPath(afterLogin)}
        >
          <img src={logo42} alt="" aria-hidden="true" />
          {t("auth.continueWith42")}
        </a>

        <p className="registration-switch">
          {t("auth.noAccount")}
          <Link to="/register">
            {t("auth.createAccount")} <span aria-hidden="true">→</span>
          </Link>
        </p>
      </div>
    </main>
  );
}

export default LoginPage;
