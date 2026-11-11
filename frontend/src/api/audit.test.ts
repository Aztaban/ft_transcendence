import { afterEach, describe, expect, test, vi } from "vitest";

import { listAuditLog } from "./audit";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("listAuditLog", () => {
  test("sends only the filters that are set, with their API names", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        jsonResponse({ count: 0, next: null, previous: null, results: [] }),
      );

    await listAuditLog();
    await listAuditLog({
      actor: 1,
      action: "role.assigned",
      targetType: "user",
      targetId: 42,
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-06T22:59:59.999Z",
      page: 2,
    });
    await listAuditLog({ page: 1 });

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/admin/audit-log/",
      "/api/v1/admin/audit-log/?actor=1&action=role.assigned&target_type=user&target_id=42" +
        "&from=2026-11-01T00%3A00%3A00.000Z&to=2026-11-06T22%3A59%3A59.999Z&page=2",
      "/api/v1/admin/audit-log/",
    ]);
  });
});
