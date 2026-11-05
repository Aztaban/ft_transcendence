import { afterEach, describe, expect, test, vi } from "vitest";

import { ApiError } from "./client";
import { assignRole, getPublicUser, revokeRole } from "./users";

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("users API", () => {
  test("gets a user's public profile", async () => {
    const person = {
      id: 7,
      display_name: "Alice",
      avatar_url: null,
      roles: [{ id: 1, name: "student" }],
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(person), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(await getPublicUser(7)).toEqual(person);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/users/7/");
  });
});

describe("assignRole", () => {
  test("posts the role name with the CSRF token and returns the updated user", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 7,
        display_name: "Alice",
        avatar_url: null,
        roles: [
          { id: 1, name: "student" },
          { id: 2, name: "tutor" },
        ],
      }),
    );

    expect(await assignRole(7, "tutor")).toEqual({
      id: 7,
      display_name: "Alice",
      avatar_url: null,
      roles: [
        { id: 1, name: "student" },
        { id: 2, name: "tutor" },
      ],
    });

    const [path, options] = fetchMock.mock.calls[1];
    const headers = new Headers(options?.headers);

    expect(path).toBe("/api/v1/users/7/roles/");
    expect(options?.method).toBe("POST");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBe('{"role":"tutor"}');
  });

  test("throws the error code when the role may not be assigned", async () => {
    document.cookie = "csrftoken=test-csrf-token; path=/";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "role_not_assignable",
            message: "You may not assign this role.",
            fields: {},
          },
        },
        403,
      ),
    );

    const error = await assignRole(7, "head_tutor").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).code).toBe("role_not_assignable");
  });
});

describe("revokeRole", () => {
  test("deletes the role by its id with the CSRF token and no body", async () => {
    document.cookie = "csrftoken=test-csrf-token; path=/";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    expect(await revokeRole(7, 2)).toBeUndefined();

    const [path, options] = fetchMock.mock.calls[0];
    const headers = new Headers(options?.headers);

    expect(path).toBe("/api/v1/users/7/roles/2/");
    expect(options?.method).toBe("DELETE");
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBeUndefined();
  });

  test("throws the error code when the admin changes their own roles", async () => {
    document.cookie = "csrftoken=test-csrf-token; path=/";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "cannot_modify_self",
            message: "You cannot change your own roles.",
            fields: {},
          },
        },
        409,
      ),
    );

    const error = await revokeRole(7, 2).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe("cannot_modify_self");
  });
});
