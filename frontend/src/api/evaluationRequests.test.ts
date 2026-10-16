import { afterEach, describe, expect, test, vi } from "vitest";

import {
  cancelEvaluationRequest,
  confirmEvaluationRequest,
  createEvaluationRequest,
  declineEvaluationRequest,
  getEvaluationRequest,
  listEvaluationRequests,
  pickSlot,
  releaseEvaluationRequest,
} from "./evaluationRequests";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const emptyPage = { count: 0, next: null, previous: null, results: [] };

describe("listEvaluationRequests", () => {
  test("asks for the Hitchhiker queue with scope=open", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(emptyPage));

    expect(await listEvaluationRequests({ scope: "open" })).toEqual(emptyPage);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/evaluation-requests/?scope=open");
  });

  test("sends status and history filters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(emptyPage));

    await listEvaluationRequests({ scope: "mine", status: ["confirmed"], history: false });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/evaluation-requests/?scope=mine&status=confirmed&history=false",
    );
  });

  test("calls the list without parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(emptyPage));

    await listEvaluationRequests();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/evaluation-requests/");
  });
});

describe("pickSlot", () => {
  afterEach(() => {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
  });

  test("posts the slot with the CSRF token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 7, status: "awaiting_confirmation" }));

    const slot = { starts_at: "2026-10-13T08:15:00.000Z", ends_at: "2026-10-13T09:00:00.000Z" };

    await pickSlot(7, slot);

    const [path, options] = fetchMock.mock.calls[1];

    expect(path).toBe("/api/v1/evaluation-requests/7/pick-slot/");
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBe(JSON.stringify(slot));
  });
});

describe("confirm and decline", () => {
  afterEach(() => {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
  });

  function mockCsrfThen(body: unknown) {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(body));

    return fetchMock;
  }

  test("confirms with POST …/confirm/ and the CSRF token", async () => {
    const fetchMock = mockCsrfThen({ id: 7, status: "confirmed" });

    await confirmEvaluationRequest(7);

    const [path, options] = fetchMock.mock.calls[1];

    expect(path).toBe("/api/v1/evaluation-requests/7/confirm/");
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBeUndefined();
  });

  test("declines with POST …/decline/", async () => {
    const fetchMock = mockCsrfThen({ id: 7, status: "pending" });

    await declineEvaluationRequest(7);

    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/evaluation-requests/7/decline/");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
  });
});

describe("getEvaluationRequest", () => {
  test("loads one request by id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: 7 }));

    await getEvaluationRequest(7);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/evaluation-requests/7/");
  });
});

describe("createEvaluationRequest", () => {
  afterEach(() => {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
  });

  test("posts the project with the CSRF token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 17, status: "pending" }, 201));

    await createEvaluationRequest({ project_id: 4 });

    const [path, options] = fetchMock.mock.calls[1];
    const headers = new Headers(options?.headers);

    expect(path).toBe("/api/v1/evaluation-requests/");
    expect(options?.method).toBe("POST");
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBe(JSON.stringify({ project_id: 4 }));
  });
});

describe("listEvaluationRequests pages", () => {
  test("sends the page number, but not page 1", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonResponse(emptyPage));

    await listEvaluationRequests({ scope: "mine", history: true, page: 2 });
    await listEvaluationRequests({ scope: "mine", history: true, page: 1 });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/evaluation-requests/?scope=mine&history=true&page=2",
    );
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/evaluation-requests/?scope=mine&history=true");
  });
});

describe("listEvaluationRequests ordering", () => {
  test("sends the ordering parameter", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(emptyPage));

    await listEvaluationRequests({ scope: "picked", history: false, ordering: "starts_at" });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/evaluation-requests/?scope=picked&history=false&ordering=starts_at",
    );
  });
});

describe.each([
  ["cancel", cancelEvaluationRequest],
  ["release", releaseEvaluationRequest],
] as const)("%s", (action, send) => {
  afterEach(() => {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
  });

  test("posts without a body, with the CSRF token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=test-csrf-token; path=/";

      return jsonResponse({ status: "ok", version: "v1" });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 5 }));

    await send(5);

    const [path, options] = fetchMock.mock.calls[1];

    expect(path).toBe(`/api/v1/evaluation-requests/5/${action}/`);
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.body).toBeUndefined();
  });
});
