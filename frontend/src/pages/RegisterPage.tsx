import { useState } from "react";
import { Button, Input } from "../components/ui";
import logo42 from "../assets/figma/42.svg";
import "../styles/registration.css";

interface RegistrationErrors {
  display_name?: string;
  email?: string;
  password?: string;
}

function RegisterPage() {
  const [errors, setErrors] = useState<RegistrationErrors>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const displayName = String(formData.get("display_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const nextErrors: RegistrationErrors = {};

    if (!displayName) {
      nextErrors.display_name = "Display name is required.";
    } else if (displayName.length > 64) {
      nextErrors.display_name = "Display name must be 64 characters or fewer.";
    }

    if (!email) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must contain at least 8 characters.";
    } else if (/^\d+$/.test(password)) {
      nextErrors.password = "Password cannot contain only numbers.";
    }

    setErrors(nextErrors);
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
            error={errors.display_name}
          />

          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            error={errors.email}
          />

          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoComplete="new-password"
            error={errors.password}
          />

          <Button className="registration-form__submit" type="submit">
            REGISTER
          </Button>
        </form>
      </div>
    </main>
  );
}

export default RegisterPage;
