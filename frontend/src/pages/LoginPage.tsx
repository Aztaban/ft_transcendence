import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import logo42 from "../assets/figma/42.svg";
import { ApiError } from "../api/client";
import { Button, Input } from "../components/ui";
import { useAuth } from "../store/AuthContext";
import "../styles/registration.css";

const OAUTH_42_REDIRECT_URL = "/api/v1/auth/42/redirect/";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_not_configured: "42 login is not available right now.",
  oauth_invalid_state: "Your 42 login session expired. Please try again.",
  oauth_missing_code: "42 login was cancelled or did not complete.",
  oauth_token_exchange_failed: "Could not verify your 42 login. Please try again.",
  oauth_profile_retrieval_failed: "Could not load your 42 profile. Please try again.",
};

function getOAuthErrorMessage(code: string | null) {
  if (!code) {
    return "";
  }

  return OAUTH_ERROR_MESSAGES[code] ?? "42 login failed. Please try again.";
}

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [error, setError] = useState(() => getOAuthErrorMessage(searchParams.get("oauth")));
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    setError("");
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === "invalid_credentials") {
        setError("Invalid email or password.");
      } else if (error instanceof ApiError) {
        setError(error.message);
      } else {
        setError("Unable to log in. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="registration-page">
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
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            required
          />

          <Input
            id="login-password"
            name="password"
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="registration-form__error" role="alert">
              {error}
            </p>
          )}

          <Button className="registration-form__submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "LOGGING IN..." : "LOGIN"}
          </Button>
        </form>

        <div className="registration-divider">
          <span>or</span>
        </div>

        <a
          className="ui-button ui-button--secondary registration-oauth"
          href={OAUTH_42_REDIRECT_URL}
        >
          <img src={logo42} alt="" aria-hidden="true" />
          CONTINUE WITH 42
        </a>
      </div>
    </main>
  );
}

export default LoginPage;
