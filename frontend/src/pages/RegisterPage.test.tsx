import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerUser } from "../api/auth";
import { ApiError } from "../api/client";
import i18n from "../i18n";
import RegisterPage from "./RegisterPage";

vi.mock("../api/auth", () => ({ registerUser: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

// Stands in for the Login page and shows what RegisterPage passed to it.
function LoginProbe() {
  const location = useLocation();
  const state = location.state as { registeredEmail?: string } | null;

  return <p>Login page for {state?.registeredEmail}</p>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const validValues = {
  display_name: "dkolarov",
  email: "diana@test.com",
  password: "TestPassword123!",
};

function fillAndSubmit(changes: Partial<typeof validValues> = {}) {
  const values = { ...validValues, ...changes };

  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: values.display_name },
  });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: values.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: values.password } });
  fireEvent.click(screen.getByRole("button", { name: "REGISTER" }));
}

// Whether a field is marked invalid, and the message linked to it with aria-describedby: the
// message shown under that field and read with it by a screen reader.
function fieldState(label: string) {
  const field = screen.getByLabelText(label);
  const messageId = field.getAttribute("aria-describedby");

  return {
    invalid: field.getAttribute("aria-invalid"),
    message: messageId ? document.getElementById(messageId)?.textContent : null,
  };
}

function invalidFieldCount() {
  return document.querySelectorAll('[aria-invalid="true"]').length;
}

describe("RegisterPage", () => {
  it("goes to the login page with the email after a successful registration", async () => {
    vi.mocked(registerUser).mockResolvedValue({
      id: 7,
      email: "diana@test.com",
      display_name: "dkolarov",
      message: "Account created successfully.",
    });
    renderPage();

    fillAndSubmit();

    expect(await screen.findByText("Login page for diana@test.com")).toBeTruthy();
    expect(registerUser).toHaveBeenCalledWith({
      display_name: "dkolarov",
      email: "diana@test.com",
      password: "TestPassword123!",
    });
  });

  it("stays on the page and shows the error when the email already exists", async () => {
    vi.mocked(registerUser).mockRejectedValue(
      new ApiError(409, "An account with this email already exists.", "email_already_exists"),
    );
    renderPage();

    fillAndSubmit();

    expect(await screen.findByText("An account with this email already exists.")).toBeTruthy();
    expect(screen.queryByText(/^Login page for/)).toBeNull();
  });
});

// Form validation (#358): the browser's checks, then the backend's (api-plan §10.1, §5.6).
describe("RegisterPage form checks", () => {
  it.each([
    ["Display name", { display_name: "   " }, "Display name is required."],
    ["Email", { email: "diana@test" }, "Enter a valid email address."],
    ["Password", { password: "Short1!" }, "Password must contain at least 8 characters."],
    ["Password", { password: "20261109" }, "Password cannot contain only numbers."],
  ])("shows the %s check under that field, without a request", (label, change, message) => {
    renderPage();

    fillAndSubmit(change);

    expect(fieldState(label)).toEqual({ invalid: "true", message });
    expect(invalidFieldCount()).toBe(1);
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("sends the corrected form after a failed check", async () => {
    vi.mocked(registerUser).mockResolvedValue({
      id: 7,
      email: "diana@test.com",
      display_name: "dkolarov",
      message: "Account created successfully.",
    });
    renderPage();

    fillAndSubmit({ email: "diana@test" });
    fillAndSubmit();

    expect(await screen.findByText("Login page for diana@test.com")).toBeTruthy();
    expect(registerUser).toHaveBeenCalledTimes(1);
    expect(registerUser).toHaveBeenCalledWith(validValues);
  });

  it("shows the backend's field messages under their fields and keeps what was typed", async () => {
    vi.mocked(registerUser).mockRejectedValue(
      new ApiError(400, "Please correct the highlighted fields.", "validation_error", {
        // The backend checks the name's length again (api-plan §10.1).
        display_name: ["Ensure this field has no more than 64 characters."],
        email: ["Use 42 login for a 42 Prague email."],
        password: ["This password is too common."],
      }),
    );
    renderPage();

    fillAndSubmit({ email: "diana@42prague.com", password: "password123" });

    expect(await screen.findByText("This password is too common.")).toBeTruthy();
    expect(fieldState("Display name")).toEqual({
      invalid: "true",
      message: "Ensure this field has no more than 64 characters.",
    });
    expect(fieldState("Email")).toEqual({
      invalid: "true",
      message: "Use 42 login for a 42 Prague email.",
    });
    expect(fieldState("Password")).toEqual({
      invalid: "true",
      message: "This password is too common.",
    });
    // Field messages replace the general one.
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("diana@42prague.com");
    expect(screen.queryByText(/^Login page for/)).toBeNull();
  });

  it("shows an error without fields above the button, such as the rate limit", async () => {
    vi.mocked(registerUser).mockRejectedValue(
      new ApiError(429, "Too many requests. Try again later.", "throttled"),
    );
    renderPage();

    fillAndSubmit();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Too many requests. Try again later.",
    );
    expect(invalidFieldCount()).toBe(0);
  });

  it("shows the generic error when the server cannot be reached", async () => {
    vi.mocked(registerUser).mockRejectedValue(new TypeError("Failed to fetch"));
    renderPage();

    fillAndSubmit();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Unable to create the account. Please try again.",
    );
    expect(screen.getByRole("button", { name: "REGISTER" })).toBeTruthy();
  });
});

describe("RegisterPage in another language", () => {
  it("shows the form and its checks in Spanish, and switches back from the pill", async () => {
    await i18n.changeLanguage("es");
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Crear una cuenta" })).toBeTruthy();
    expect(document.title).toBe("Crear una cuenta · 42 Evals");

    fireEvent.click(screen.getByRole("button", { name: "REGISTRARSE" }));

    expect(screen.getByText("El nombre visible es obligatorio.")).toBeTruthy();
    expect(screen.getByText("El correo electrónico es obligatorio.")).toBeTruthy();
    expect(screen.getByText("La contraseña es obligatoria.")).toBeTruthy();
    expect(registerUser).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("button", { name: "REGISTER" })).toBeTruthy();
    expect(await screen.findByText("Display name is required.")).toBeTruthy();
    expect(screen.getByText("Password is required.")).toBeTruthy();
  });
});

describe("RegisterPage link to Login", () => {
  it("goes back to the Login page", () => {
    renderPage();

    expect(screen.getByText("Already have an account?")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Log in" }));

    expect(screen.getByText("Login page for")).toBeTruthy();
    expect(registerUser).not.toHaveBeenCalled();
  });
});
