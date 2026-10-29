import { afterEach, describe, expect, test, vi } from "vitest";

import { getPublicUser } from "./users";

afterEach(() => {
  vi.restoreAllMocks();
});

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
