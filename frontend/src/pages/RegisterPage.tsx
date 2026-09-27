import { Button, Input } from "../components/ui";
import logo42 from "../assets/figma/42.svg";
import "../styles/registration.css";

function RegisterPage() {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
            id="display-name"
            name="display_name"
            type="text"
            placeholder="Display name"
            aria-label="Display name"
            autoComplete="username"
            required
          />

          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            required
          />

          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoComplete="new-password"
            required
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
