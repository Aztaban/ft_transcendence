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

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "dkolarov" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "diana@test.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "TestPassword123!" } });
  fireEvent.click(screen.getByRole("button", { name: "REGISTER" }));
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

describe("RegisterPage in another language", () => {
  it("shows the form and its checks in Spanish, and switches back from the pill", async () => {
    await i18n.changeLanguage("es");
    renderPage();

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
