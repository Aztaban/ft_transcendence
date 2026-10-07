import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AuthProvider } from "../store/AuthContext";
import LoginPage from "./LoginPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function mockFetch() {
  return vi.spyOn(globalThis, "fetch");
}

function renderLoginPage(initialEntry = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Home after login</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function mockAnonymousSession(fetchMock: ReturnType<typeof mockFetch>) {
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        error: {
          code: "not_authenticated",
          message: "Authentication required.",
        },
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
}

function mockCsrf(fetchMock: ReturnType<typeof mockFetch>) {
  fetchMock.mockImplementationOnce(async () => {
    document.cookie = "csrftoken=test-csrf-token; path=/";

    return new Response(JSON.stringify({ status: "ok", version: "v1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("LoginPage", () => {
  test("logs in and navigates to the home page", async () => {
    const fetchMock = mockFetch();

    mockAnonymousSession(fetchMock);
    mockCsrf(fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 1,
          email: "login@example.com",
          display_name: "test-login",
          message: "Logged in successfully.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "login@example.com" },
    });

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "TestLoginPassword123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "LOGIN" }));

    await waitFor(() => {
      expect(screen.getByText("Home after login")).toBeDefined();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/login/",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
      }),
    );
  });

  test("shows an error when credentials are invalid", async () => {
    const fetchMock = mockFetch();

    mockAnonymousSession(fetchMock);
    mockCsrf(fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "invalid_credentials",
            message: "Invalid email or password.",
          },
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "login@example.com" },
    });

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "WrongPassword123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "LOGIN" }));

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toBe("Invalid email or password.");
  });

  test("links to the backend 42 OAuth redirect", () => {
    mockAnonymousSession(mockFetch());

    renderLoginPage();

    const link = screen.getByRole("link", { name: "CONTINUE WITH 42" });

    expect(link.getAttribute("href")).toBe("/api/v1/auth/42/redirect/");
  });

  test.each([
    ["oauth_not_configured", "42 login is not available right now."],
    ["oauth_invalid_state", "Your 42 login session expired. Please try again."],
    ["oauth_missing_code", "42 login was cancelled or did not complete."],
    ["oauth_token_exchange_failed", "Could not verify your 42 login. Please try again."],
    ["oauth_profile_retrieval_failed", "Could not load your 42 profile. Please try again."],
    ["oauth_access_denied", "42 login was denied. Please authorize access to continue."],
    ["oauth_provider_error", "42 is having trouble right now. Please try again later."],
    ["oauth_account_suspended", "Your account is suspended or disabled."],
    [
      "oauth_account_exists",
      "An account with this email already exists. Log in with your email and password.",
    ],
    ["oauth_identity_conflict", "Your 42 account could not be linked. Please contact support."],
    ["oauth_account_conflict", "Could not create your account from 42. Please try again."],
  ])("shows the message for the %s OAuth error", async (code, message) => {
    mockAnonymousSession(mockFetch());

    renderLoginPage(`/login?oauth=${code}`);

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toBe(message);
  });

  test("shows a generic error for an unknown 42 OAuth error code", async () => {
    mockAnonymousSession(mockFetch());

    renderLoginPage("/login?oauth=something_unexpected");

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toBe("42 login failed. Please try again.");
  });

  test("removes the oauth error code from the URL but keeps the message", async () => {
    mockAnonymousSession(mockFetch());

    render(
      <MemoryRouter initialEntries={["/login?oauth=oauth_access_denied"]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <>
                  <LoginPage />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/login"));
    expect(screen.getByRole("alert").textContent).toBe(
      "42 login was denied. Please authorize access to continue.",
    );
  });
});
