import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AuthProvider } from "../store/AuthContext";
import LoginPage from "./LoginPage";

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

function mockFetch() {
  return vi.spyOn(globalThis, "fetch");
}

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
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
});
