import { useState } from "react";
import { useNavigate } from "react-router";

import logo42 from "../assets/figma/42.svg";
import { ApiError } from "../api/client";
import { Button, Input } from "../components/ui";
import { useAuth } from "../store/AuthContext";
import "../styles/registration.css";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [error, setError] = useState("");
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
      </div>
    </main>
  );
}

export default LoginPage;
