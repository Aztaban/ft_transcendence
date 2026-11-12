import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import {
  deleteSCMessage,
  getSCMessage,
  revealSCMessageSender,
  saveSCMessageNote,
  setSCMessageRead,
} from "../api/scMessages";
import i18n from "../i18n";
import type { SCMessage } from "../types/scMessage";
import { CouncilMessageRoute } from "./CouncilInboxMessagePage";

vi.mock("../api/scMessages", () => ({
  SC_NOTE_MAX_LENGTH: 5000,
  SC_DELETE_REASON_MAX_LENGTH: 500,
  SC_REVEAL_REASON_MIN_LENGTH: 10,
  SC_REVEAL_REASON_MAX_LENGTH: 500,
  getSCMessage: vi.fn(),
  setSCMessageRead: vi.fn(),
  saveSCMessageNote: vi.fn(),
  deleteSCMessage: vi.fn(),
  revealSCMessageSender: vi.fn(),
}));

// The user's real roles from /users/me/: a council member unless a test logs in an Admin.
const currentUser = vi.hoisted(() => ({ roles: ["student", "sc_member"] }));

vi.mock("../store/CurrentUserContext", () => ({
  useCurrentUser: () => ({ ...currentUser, user: null, isLoaded: true, refresh: () => {} }),
}));

const unread: SCMessage = {
  id: 3,
  body: "I'd like to suggest adding a few more quiet study areas on campus.",
  read_at: null,
  discussion_note: "",
  discussion_note_version: 4,
  created_at: "2026-10-17T08:00:00Z",
};

const read: SCMessage = { ...unread, read_at: "2026-07-04T10:00:00Z" };

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  currentUser.roles = ["student", "sc_member"];
});

function BrowserBack() {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate(-1)}>
      Browser back
    </button>
  );
}

// `from` is the router state the History's "Open" link sets. `earlier` is a message opened
// before this one, so the browser's Back goes there.
function renderPage(from?: string, earlier?: number) {
  const current = { pathname: "/council/inbox/3", state: from ? { from } : null };

  return render(
    <MemoryRouter
      initialEntries={earlier ? [`/council/inbox/${earlier}`, current] : [current]}
      initialIndex={earlier ? 1 : 0}
    >
      <BrowserBack />
      <Routes>
        <Route path="/council/inbox/:id" element={<CouncilMessageRoute />} />
        <Route path="/council/inbox" element={<div>Messages page</div>} />
        <Route path="/council/history" element={<div>History page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function button(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

function noteBox() {
  return screen.getByRole("textbox", { name: "Council note" }) as HTMLTextAreaElement;
}

describe("CouncilInboxMessagePage", () => {
  it("shows the whole anonymous message without marking it read", async () => {
    vi.mocked(getSCMessage).mockResolvedValue(unread);

    renderPage();

    expect(await screen.findByText(unread.body)).toBeTruthy();
    expect(getSCMessage).toHaveBeenCalledWith(3);
    expect(screen.getByRole("heading", { name: "Message #3" })).toBeTruthy();
    expect(document.title).toBe("Message #3 · 42 Evals");
    expect(screen.getByText("Not read by the council yet")).toBeTruthy();
    expect(setSCMessageRead).not.toHaveBeenCalled();
  });

  it("marks it read and shows the popup, which goes back to the messages", async () => {
    vi.mocked(getSCMessage).mockResolvedValue(unread);
    vi.mocked(setSCMessageRead).mockResolvedValue(read);
    renderPage();
    await screen.findByText(unread.body);

    fireEvent.click(button("Mark as read"));

    expect(
      await screen.findByRole("dialog", {
        name: "Done. The message is marked as read.",
      }),
    ).toBeTruthy();
    expect(setSCMessageRead).toHaveBeenCalledWith(3, true);
    expect(screen.getByText("Marked as read, 4 July 2026")).toBeTruthy();

    fireEvent.click(screen.getByTestId("marked-read-backdrop"));

    expect(screen.getByText("Messages page")).toBeTruthy();
  });

  it("marks a read message unread again", async () => {
    vi.mocked(getSCMessage).mockResolvedValue(read);
    vi.mocked(setSCMessageRead).mockResolvedValue(unread);
    renderPage();

    expect(await screen.findByText("Marked as read, 4 July 2026")).toBeTruthy();
    expect(screen.getByText("Read 4 July 2026")).toBeTruthy();

    fireEvent.click(button("Mark as unread"));

    expect(await screen.findByText("Not read by the council yet")).toBeTruthy();
    expect(setSCMessageRead).toHaveBeenCalledWith(3, false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("goes back to the messages, also from a read message", async () => {
    vi.mocked(getSCMessage).mockResolvedValue(read);
    renderPage();
    await screen.findByText(read.body);

    fireEvent.click(button("Back to the messages"));

    expect(screen.getByText("Messages page")).toBeTruthy();
  });

  // #279: a member reading old messages keeps their place in the History.
  it("goes back to the History, also from the popup, when the message was opened there", async () => {
    vi.mocked(getSCMessage).mockResolvedValue(unread);
    vi.mocked(setSCMessageRead).mockResolvedValue(read);
    renderPage("/council/history");
    await screen.findByText(unread.body);

    fireEvent.click(button("Mark as read"));
    fireEvent.click(await screen.findByTestId("marked-read-backdrop"));

    expect(screen.getByText("History page")).toBeTruthy();
  });

  it("goes back to the messages when it was opened from anywhere else", async () => {
    vi.mocked(getSCMessage).mockResolvedValue(read);
    renderPage("https://example.com/");
    await screen.findByText(read.body);

    fireEvent.click(button("Back to the messages"));

    expect(screen.getByText("Messages page")).toBeTruthy();
  });

  it("does not overwrite a colleague's note brought in by marking the message unread", async () => {
    vi.mocked(getSCMessage).mockResolvedValue({ ...read, discussion_note: "Old note" });
    vi.mocked(setSCMessageRead).mockResolvedValue({
      ...unread,
      discussion_note: "Colleague's note",
      discussion_note_version: 5,
    });
    vi.mocked(saveSCMessageNote).mockRejectedValue(
      new ApiError(409, "Someone else saved the note.", "edit_conflict"),
    );
    renderPage();
    await screen.findByText(read.body);

    fireEvent.change(noteBox(), { target: { value: "My note" } });
    fireEvent.click(button("Mark as unread"));
    await screen.findByText("Not read by the council yet");
    fireEvent.click(button("Save note"));

    // Saved against the version the draft started from, so the server answers 409.
    await screen.findByText("Another council member saved the note in the meantime.");
    expect(saveSCMessageNote).toHaveBeenCalledWith(3, "My note", 4);
    expect(noteBox().value).toBe("My note");
  });

  // Form validation (#358): the backend's message about the note (api-plan §10.6, up to 5000).
  it("shows the backend's message about the note and keeps the draft", async () => {
    vi.mocked(getSCMessage).mockResolvedValue(unread);
    vi.mocked(saveSCMessageNote).mockRejectedValue(
      new ApiError(400, "Please correct the highlighted fields.", "validation_error", {
        discussion_note: ["Ensure this field has no more than 5000 characters."],
      }),
    );
    renderPage();
    await screen.findByText(unread.body);

    fireEvent.change(noteBox(), { target: { value: "Forwarded to the building manager." } });
    fireEvent.click(button("Save note"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Ensure this field has no more than 5000 characters.",
    );
    expect(noteBox().value).toBe("Forwarded to the building manager.");
    expect(button("Save note").disabled).toBe(false);
  });

  it("saves the council note with the version it was loaded at", async () => {
    vi.mocked(getSCMessage).mockResolvedValue(unread);
    vi.mocked(saveSCMessageNote).mockResolvedValue({
      ...unread,
      discussion_note: "Forwarded to the building manager.",
      discussion_note_version: 5,
    });
    renderPage();
    await screen.findByText(unread.body);

    expect(button("Save note").disabled).toBe(true);

    fireEvent.change(noteBox(), { target: { value: "Forwarded to the building manager." } });
    fireEvent.click(button("Save note"));

    expect((await screen.findByRole("status")).textContent).toBe("Saved ✓");
    expect(saveSCMessageNote).toHaveBeenCalledWith(3, "Forwarded to the building manager.", 4);
    expect(button("Save note").disabled).toBe(true);
  });

  it("keeps the draft and shows the other member's note after an edit conflict", async () => {
    vi.mocked(getSCMessage)
      .mockResolvedValueOnce(unread)
      .mockResolvedValueOnce({
        ...unread,
        discussion_note: "Asked the staff about it.",
        discussion_note_version: 5,
      });
    vi.mocked(saveSCMessageNote)
      .mockRejectedValueOnce(new ApiError(409, "Conflict", "edit_conflict"))
      .mockResolvedValueOnce({ ...unread, discussion_note: "Merged.", discussion_note_version: 6 });
    renderPage();
    await screen.findByText(unread.body);

    fireEvent.change(noteBox(), { target: { value: "My draft." } });
    fireEvent.click(button("Save note"));

    const conflict = await screen.findByRole("alert");

    expect(conflict.textContent).toContain(
      "Another council member saved the note in the meantime.",
    );
    expect(conflict.textContent).toContain("Asked the staff about it.");
    expect(noteBox().value).toBe("My draft.");

    fireEvent.change(noteBox(), { target: { value: "Merged." } });
    fireEvent.click(button("Save note"));

    expect(await screen.findByText("Saved ✓")).toBeTruthy();
    expect(saveSCMessageNote).toHaveBeenLastCalledWith(3, "Merged.", 5);
  });

  it("asks to save the note before marking the message read, so the draft is not lost", async () => {
    vi.mocked(getSCMessage).mockResolvedValue(unread);
    renderPage();
    await screen.findByText(unread.body);

    fireEvent.change(noteBox(), { target: { value: "Draft" } });

    expect(button("Mark as read").disabled).toBe(true);
    expect(screen.getByText("Save the note before marking the message as read.")).toBeTruthy();

    fireEvent.change(noteBox(), { target: { value: "" } });

    expect(button("Mark as read").disabled).toBe(false);
  });

  it("explains when the message does not exist", async () => {
    vi.mocked(getSCMessage).mockRejectedValue(new ApiError(404, "Not found.", "not_found"));

    renderPage();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This message does not exist or was removed.",
    );
  });
});

describe("CouncilInboxMessagePage moderation", () => {
  async function openAsAdmin() {
    currentUser.roles = ["student", "admin"];
    vi.mocked(getSCMessage).mockResolvedValue(unread);
    renderPage();
    await screen.findByText(unread.body);
  }

  function reasonBox() {
    return within(screen.getByRole("dialog")).getByRole("textbox", {
      name: "Reason",
    }) as HTMLTextAreaElement;
  }

  it("is not offered to council members", async () => {
    vi.mocked(getSCMessage).mockResolvedValue(unread);
    renderPage();
    await screen.findByText(unread.body);

    expect(screen.queryByRole("heading", { name: "Moderation" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete message" })).toBeNull();
  });

  it("reveals the sender to an Admin once a long enough reason is given", async () => {
    vi.mocked(revealSCMessageSender).mockResolvedValue({
      sender: { id: 7, display_name: "Alice", email: "alice@example.com" },
    });
    await openAsAdmin();

    fireEvent.click(button("Reveal sender"));

    const dialog = screen.getByRole("dialog", { name: "Reveal who sent message #3?" });
    const confirm = within(dialog).getByRole("button", { name: "Reveal sender" });

    fireEvent.change(reasonBox(), { target: { value: "  too short " } });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByText("At least 10 characters")).toBeTruthy();

    fireEvent.change(reasonBox(), { target: { value: "  Threats against a student.  " } });
    fireEvent.click(confirm);

    expect(await screen.findByRole("link", { name: "Alice" })).toBeTruthy();
    expect(revealSCMessageSender).toHaveBeenCalledWith(3, "Threats against a student.");
    expect(screen.getByRole("link", { name: "Alice" }).getAttribute("href")).toBe("/people/7");
    expect(screen.getByText("alice@example.com")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reveal sender" })).toBeNull();
  });

  it("says when the sender's account was deleted", async () => {
    vi.mocked(revealSCMessageSender).mockResolvedValue({ sender: null });
    await openAsAdmin();

    fireEvent.click(button("Reveal sender"));
    fireEvent.change(reasonBox(), { target: { value: "Threats against a student." } });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Reveal sender" }),
    );

    expect(await screen.findByText("The sender's account was deleted.")).toBeTruthy();
  });

  it("deletes the message with a reason and says so", async () => {
    vi.mocked(deleteSCMessage).mockResolvedValue(undefined);
    await openAsAdmin();

    fireEvent.click(button("Delete message"));

    const dialog = screen.getByRole("dialog", { name: "Delete message #3?" });
    const confirm = within(dialog).getByRole("button", { name: "Delete message" });

    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(reasonBox(), { target: { value: "Insults." } });
    fireEvent.click(confirm);

    expect((await screen.findByRole("status")).textContent).toContain(
      "The message was deleted. The reason is saved in the audit log.",
    );
    expect(deleteSCMessage).toHaveBeenCalledWith(3, "Insults.");
    expect(screen.queryByText(unread.body)).toBeNull();
    expect(screen.getByRole("link", { name: "Back to the messages" }).getAttribute("href")).toBe(
      "/council/inbox",
    );
  });

  it("keeps the popup open with the server's message about the reason", async () => {
    vi.mocked(deleteSCMessage).mockRejectedValue(
      new ApiError(400, "Invalid input.", "validation_error", {
        reason: ["Ensure this field has no more than 500 characters."],
      }),
    );
    await openAsAdmin();

    fireEvent.click(button("Delete message"));
    fireEvent.change(reasonBox(), { target: { value: "Insults." } });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete message" }),
    );

    expect((await within(screen.getByRole("dialog")).findByRole("alert")).textContent).toBe(
      "Ensure this field has no more than 500 characters.",
    );
    expect(screen.getByText(unread.body)).toBeTruthy();
  });

  it.each([
    ["Delete message", "Insults."],
    ["Reveal sender", "Threats against a student."],
  ])(
    "shows the message is gone when another Admin deleted it first (%s)",
    async (action, reason) => {
      const gone = new ApiError(404, "Not found.", "not_found");

      vi.mocked(deleteSCMessage).mockRejectedValue(gone);
      vi.mocked(revealSCMessageSender).mockRejectedValue(gone);
      await openAsAdmin();

      fireEvent.click(button(action));
      fireEvent.change(reasonBox(), { target: { value: reason } });
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: action }));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "This message does not exist or was removed.",
      );
      // Nothing left to retry: the popup, the message and its buttons are gone.
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByText(unread.body)).toBeNull();
      expect(screen.queryByRole("button", { name: "Delete message" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Reveal sender" })).toBeNull();
    },
  );

  // Moving between messages keeps the route: without a new page per id, the popup, its reason
  // and the result of an action would land on the other message.
  it("starts fresh on another message: Back during a delete does not delete that one", async () => {
    const first: SCMessage = { ...unread, id: 1, body: "The first message." };

    currentUser.roles = ["student", "admin"];
    vi.mocked(getSCMessage).mockImplementation(async (id) => (id === 1 ? first : unread));
    renderPage(undefined, 1);
    await screen.findByText(unread.body);

    fireEvent.click(button("Delete message"));
    fireEvent.change(reasonBox(), { target: { value: "Insults." } });
    fireEvent.click(button("Browser back"));

    expect(await screen.findByText(first.body)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Message #1" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteSCMessage).not.toHaveBeenCalled();
  });

  it("starts fresh on another message: a revealed sender stays with its message", async () => {
    const first: SCMessage = { ...unread, id: 1, body: "The first message." };

    currentUser.roles = ["student", "admin"];
    vi.mocked(getSCMessage).mockImplementation(async (id) => (id === 1 ? first : unread));
    vi.mocked(revealSCMessageSender).mockResolvedValue({
      sender: { id: 7, display_name: "Alice", email: "alice@example.com" },
    });
    renderPage(undefined, 1);
    await screen.findByText(unread.body);

    fireEvent.click(button("Reveal sender"));
    fireEvent.change(reasonBox(), { target: { value: "Threats against a student." } });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Reveal sender" }),
    );
    await screen.findByRole("link", { name: "Alice" });

    fireEvent.click(button("Browser back"));

    expect(await screen.findByText(first.body)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Alice" })).toBeNull();
    expect(button("Reveal sender")).toBeTruthy();
  });

  it("does not close on Escape while the request is being sent", async () => {
    vi.mocked(deleteSCMessage).mockReturnValue(new Promise(() => {}));
    await openAsAdmin();

    fireEvent.click(button("Delete message"));
    fireEvent.change(reasonBox(), { target: { value: "Insults." } });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete message" }),
    );
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Saving…" }),
    ).toBeTruthy();
  });

  it("closes without doing anything on Cancel", async () => {
    await openAsAdmin();

    fireEvent.click(button("Delete message"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteSCMessage).not.toHaveBeenCalled();
  });

  it("shows the moderation in Czech", async () => {
    await i18n.changeLanguage("cs");
    await openAsAdmin();

    expect(screen.getByRole("heading", { name: "Moderace" })).toBeTruthy();

    fireEvent.click(button("Zobrazit odesílatele"));

    expect(screen.getByText("Alespoň 10 znaků")).toBeTruthy();
  });
});
