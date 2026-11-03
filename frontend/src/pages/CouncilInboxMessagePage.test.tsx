import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { getSCMessage, saveSCMessageNote, setSCMessageRead } from "../api/scMessages";
import type { SCMessage } from "../types/scMessage";
import CouncilInboxMessagePage from "./CouncilInboxMessagePage";

vi.mock("../api/scMessages", () => ({
  SC_NOTE_MAX_LENGTH: 5000,
  getSCMessage: vi.fn(),
  setSCMessageRead: vi.fn(),
  saveSCMessageNote: vi.fn(),
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
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/council/inbox/3"]}>
      <Routes>
        <Route path="/council/inbox/:id" element={<CouncilInboxMessagePage />} />
        <Route path="/council/inbox" element={<div>Messages page</div>} />
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
