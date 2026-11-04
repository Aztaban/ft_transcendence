import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSession, loginUser, registerUser } from "../api/auth";
import i18n from "../i18n";
import { AuthProvider } from "../store/AuthContext";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

vi.mock("../api/auth", () => ({
  getSession: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}));

const user = { id: 7, email: "diana@test.com", display_name: "dkolarov" };

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ authenticated: false, user: null });
});

afterEach(async () => {
  cleanup();
  vi.resetAllMocks();
  await i18n.changeLanguage("en");
});

function Where() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <p data-testid="where">{location.pathname + location.search}</p>
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
    </>
  );
}

// The login gate's redirect: Login with the page the user wanted, after an earlier page.
function renderFromGate() {
  return render(
    <MemoryRouter
      initialEntries={[
        "/earlier",
        { pathname: "/login", state: { from: { pathname: "/history", search: "?status=done" } } },
      ]}
      initialIndex={1}
    >
      <AuthProvider>
        <Where />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={null} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function whereNow() {
  return screen.getByTestId("where").textContent;
}

async function logIn() {
  vi.mocked(loginUser).mockResolvedValue({ ...user, message: "Logged in." });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "diana@test.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "TestPassword123!" } });
  fireEvent.click(screen.getByRole("button", { name: "LOGIN" }));
  await waitFor(() => expect(whereNow()).toBe("/history?status=done"));
}

function fillAndRegister() {
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "dkolarov" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "diana@test.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "TestPassword123!" } });
  fireEvent.click(screen.getByRole("button", { name: "REGISTER" }));
}

describe("Login and Register links", () => {
  it("keeps the wanted page when the user goes to Register and back", async () => {
    renderFromGate();

    fireEvent.click(await screen.findByRole("link", { name: "Create one" }));
    expect(whereNow()).toBe("/register");

    fireEvent.click(screen.getByRole("link", { name: "Log in" }));
    expect(whereNow()).toBe("/login");

    await logIn();
  });

  it("keeps the wanted page through a registration", async () => {
    vi.mocked(registerUser).mockResolvedValue({ ...user, message: "Account created." });
    renderFromGate();

    fireEvent.click(await screen.findByRole("link", { name: "Create one" }));
    fillAndRegister();

    expect(await screen.findByText("Account created. You can log in now.")).toBeTruthy();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("diana@test.com");

    await logIn();
  });

  it("leaves both pages with one step back", async () => {
    renderFromGate();

    fireEvent.click(await screen.findByRole("link", { name: "Create one" }));
    fireEvent.click(screen.getByRole("link", { name: "Log in" }));
    fireEvent.click(screen.getByRole("link", { name: "Create one" }));
    fireEvent.click(screen.getByRole("button", { name: "Browser back" }));

    await waitFor(() => expect(whereNow()).toBe("/earlier"));
  });

  it("stays on Register while the registration is being sent", async () => {
    vi.mocked(registerUser).mockReturnValue(new Promise(() => {}));
    renderFromGate();

    fireEvent.click(await screen.findByRole("link", { name: "Create one" }));
    fillAndRegister();

    const link = await screen.findByRole("link", { name: "Log in" });

    await waitFor(() => expect(link.getAttribute("aria-disabled")).toBe("true"));
    expect(link.getAttribute("tabindex")).toBe("-1");

    fireEvent.click(link);

    expect(whereNow()).toBe("/register");
  });

  it("separates the question and the link with a space", async () => {
    renderFromGate();

    const link = await screen.findByRole("link", { name: "Create one" });

    expect(link.parentElement?.textContent).toBe("Don't have an account? Create one →");
  });

  it.each([
    ["cs", "Nemáte účet?", "Vytvořte si ho", "Už máte účet?", "Přihlaste se"],
    ["es", "¿No tienes cuenta?", "Crea una", "¿Ya tienes cuenta?", "Inicia sesión"],
  ])("shows both links in %s", async (language, noAccount, create, haveAccount, logInLabel) => {
    await i18n.changeLanguage(language);
    renderFromGate();

    fireEvent.click(await screen.findByRole("link", { name: create }));

    expect(screen.getByRole("link", { name: logInLabel }).parentElement?.textContent).toContain(
      haveAccount,
    );

    fireEvent.click(screen.getByRole("link", { name: logInLabel }));

    expect(screen.getByRole("link", { name: create }).parentElement?.textContent).toContain(
      noAccount,
    );
  });
});
