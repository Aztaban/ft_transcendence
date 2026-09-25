import { useState, type FormEvent } from "react";

import { registerUser } from "../api/auth";
import { ApiError } from "../api/client";
import logo42 from "../assets/figma/42.svg";
import { Button, Input } from "../components/ui";
import {
  DISPLAY_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateRegistration,
  type RegistrationFieldErrors,
} from "../utils/validation";
import "../styles/registration.css";

function RegisterPage() {
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
    setSuccessMessage("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await registerUser(values);

      setErrors({});
      setSuccessMessage(response.message);
      form.reset();
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
        setFormError("Unable to create the account. Please try again.");
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

        <form className="registration-form" onSubmit={handleSubmit} noValidate>
          <Input
            id="display-name"
            name="display_name"
            type="text"
            placeholder="Display name"
            aria-label="Display name"
            autoComplete="username"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            error={errors.display_name}
          />

          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            maxLength={EMAIL_MAX_LENGTH}
            error={errors.email}
          />

          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Password"
            aria-label="Password"
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

          {successMessage && (
            <p
              className="registration-form__message registration-form__message--success"
              role="status"
            >
              {successMessage}
            </p>
          )}

          <Button className="registration-form__submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "REGISTERING..." : "REGISTER"}
          </Button>
        </form>
      </div>
    </main>
  );
}

export default RegisterPage;
