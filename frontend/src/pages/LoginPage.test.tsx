import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AuthProvider } from "../store/AuthContext";
import LoginPage from "./LoginPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

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

  test("shows an error when 42 OAuth fails", async () => {
    mockAnonymousSession(mockFetch());

    renderLoginPage("/login?oauth=oauth_token_exchange_failed");

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toBe("Could not verify your 42 login. Please try again.");
  });

  test("shows a generic error for an unknown 42 OAuth error code", async () => {
    mockAnonymousSession(mockFetch());

    renderLoginPage("/login?oauth=something_unexpected");

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toBe("42 login failed. Please try again.");
  });
});
