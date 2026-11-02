import { afterEach, describe, expect, test, vi } from "vitest";

import {
  getSCMessage,
  listSCMessages,
  saveSCMessageNote,
  sendSCMessage,
  setSCMessageRead,
} from "./scMessages";

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

describe("sendSCMessage", () => {
  test("posts the message with the CSRF token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 3, created_at: "2026-10-17T10:00:00Z" }, 201),
    );

    expect(await sendSCMessage({ body: "The 3rd floor fridge is broken again." })).toEqual({
      id: 3,
      created_at: "2026-10-17T10:00:00Z",
    });

    const [path, options] = fetchMock.mock.calls[1];
    const headers = new Headers(options?.headers);

    expect(path).toBe("/api/v1/sc-messages/");
    expect(options?.method).toBe("POST");
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBe(JSON.stringify({ body: "The 3rd floor fridge is broken again." }));
  });
});

const message = {
  id: 3,
  body: "The 3rd floor fridge is broken again.",
  read_at: null,
  discussion_note: "",
  discussion_note_version: 0,
  created_at: "2026-10-08T12:00:00Z",
};

describe("listSCMessages", () => {
  test("asks for a page, newest first, and only unread messages when asked", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        jsonResponse({ count: 1, next: null, previous: null, results: [message] }),
      );

    expect((await listSCMessages()).results).toEqual([message]);
    await listSCMessages({ unread: true });
    await listSCMessages({ unread: false, page: 2 });
    await listSCMessages({ unread: true, page: 1 });

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/sc-messages/",
      "/api/v1/sc-messages/?unread=true",
      "/api/v1/sc-messages/?page=2",
      "/api/v1/sc-messages/?unread=true",
    ]);
  });
});

describe("getSCMessage", () => {
  test("loads one message", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(message));

    expect(await getSCMessage(3)).toEqual(message);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/sc-messages/3/");
  });
});

describe("updating a message", () => {
  function mockPatch() {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(message));

    return fetchMock;
  }

  test("marks it read or unread without a version", async () => {
    const fetchMock = mockPatch();

    await setSCMessageRead(3, true);

    const [path, options] = fetchMock.mock.calls[1];

    expect(path).toBe("/api/v1/sc-messages/3/");
    expect(options?.method).toBe("PATCH");
    expect(new Headers(options?.headers).get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBe(JSON.stringify({ is_read: true }));
  });

  test("saves the note with the version it was loaded at", async () => {
    const fetchMock = mockPatch();

    await saveSCMessageNote(3, "Forwarded to the building manager.", 4);

    const [path, options] = fetchMock.mock.calls[1];

    expect(path).toBe("/api/v1/sc-messages/3/");
    expect(options?.method).toBe("PATCH");
    expect(options?.body).toBe(
      JSON.stringify({
        discussion_note: "Forwarded to the building manager.",
        discussion_note_version: 4,
      }),
    );
  });
});
