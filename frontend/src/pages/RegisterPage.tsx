import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { registerUser } from "../api/auth";
import { ApiError } from "../api/client";
import logo42 from "../assets/figma/42.svg";
import AuthSwitchLink from "../components/auth/AuthSwitchLink";
import LanguageSwitcher from "../components/layout/LanguageSwitcher";
import { Button, Input } from "../components/ui";
import {
  DISPLAY_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateRegistration,
  type RegistrationFieldErrors,
  type RegistrationValues,
} from "../utils/validation";
import type { ReturnPage } from "../utils/loginReturn";
import "../styles/registration.css";

function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // The page the login gate sent the user away from (#328), passed on to the Login page.
  const from = (location.state as { from?: ReturnPage } | null)?.from;
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  // The values that failed the checks in the browser, so the messages can be shown again in a
  // newly chosen language. Errors from the backend are not checked again.
  const [invalidValues, setInvalidValues] = useState<RegistrationValues | null>(null);

  useEffect(() => {
    if (invalidValues) {
      setErrors(validateRegistration(invalidValues));
    }
  }, [i18n.language, invalidValues]);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const values = {
      display_name: String(formData.get("display_name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    };

    const validationErrors = validateRegistration(values);

    setErrors(validationErrors);
    setFormError("");

    if (Object.keys(validationErrors).length > 0) {
      setInvalidValues(values);
      return;
    }

    setInvalidValues(null);

    setIsSubmitting(true);

    try {
      await registerUser(values);

      // Registration does not start a session (api-plan §10.1), so the user logs in next (#522).
      navigate("/login", { replace: true, state: { registeredEmail: values.email, from } });
    } catch (error) {
      if (error instanceof ApiError) {
        const backendErrors: RegistrationFieldErrors = {
          display_name: error.fields?.display_name?.[0],
          email: error.fields?.email?.[0],
          password: error.fields?.password?.[0],
        };

        if (error.status === 409 && error.code === "email_already_exists") {
          backendErrors.email = error.message;
        }

        const hasFieldErrors = Object.values(backendErrors).some(Boolean);

        setErrors(backendErrors);

        if (!hasFieldErrors) {
          setFormError(error.message);
        }
      } else {
        setFormError(t("auth.registerError"));
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

        <form className="registration-form" onSubmit={handleSubmit} noValidate>
          <Input
            id="display-name"
            name="display_name"
            type="text"
            placeholder={t("auth.displayName")}
            aria-label={t("auth.displayName")}
            autoComplete="username"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            error={errors.display_name}
          />

          <Input
            id="email"
            name="email"
            type="email"
            placeholder={t("auth.email")}
            aria-label={t("auth.email")}
            autoComplete="email"
            maxLength={EMAIL_MAX_LENGTH}
            error={errors.email}
          />

          <Input
            id="password"
            name="password"
            type="password"
            placeholder={t("auth.password")}
            aria-label={t("auth.password")}
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            error={errors.password}
          />

          {formError && (
            <p
              className="registration-form__message registration-form__message--error"
              role="alert"
            >
              {formError}
            </p>
          )}

          <Button className="registration-form__submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("auth.registering") : t("auth.register")}
          </Button>
        </form>

        <AuthSwitchLink
          prompt={t("auth.haveAccount")}
          label={t("auth.goToLogin")}
          to="/login"
          from={from}
          disabled={isSubmitting}
        />
      </div>
    </main>
  );
}

export default RegisterPage;
