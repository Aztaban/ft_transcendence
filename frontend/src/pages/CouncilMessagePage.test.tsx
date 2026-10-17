import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { sendSCMessage } from "../api/scMessages";
import CouncilMessagePage from "./CouncilMessagePage";

vi.mock("../api/scMessages", () => ({ SC_MESSAGE_MAX_LENGTH: 5000, sendSCMessage: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/council/send"]}>
      <Routes>
        <Route path="/council/send" element={<CouncilMessagePage />} />
        <Route path="/council" element={<div>Student Council page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function messageBox() {
  return screen.getByRole("textbox", {
    name: "Your message to the Student Council",
  }) as HTMLTextAreaElement;
}

function sendButton(name = "Send Message") {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

function write(text: string) {
  fireEvent.change(messageBox(), { target: { value: text } });
}

describe("CouncilMessagePage", () => {
  it("says who reads the message and how the identity is kept", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Anonymous Message" })).toBeTruthy();
    expect(
      screen.getByText(
        "Your identity will NOT be shared with the council members. It is stored only to investigate abuse.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Recipient").parentElement?.textContent).toBe(
      "RecipientStudent Council",
    );
    expect(screen.getByText("Characters: 0 / 5000")).toBeTruthy();
    expect(messageBox().maxLength).toBe(5000);
    expect(sendButton().disabled).toBe(true);
  });

  it("lists what stays private", () => {
    renderPage();

    const panel = screen.getByRole("heading", { name: "Your privacy" })
      .parentElement as HTMLElement;

    expect(
      within(panel)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "The council never sees who wrote the message.",
      "Your identity is stored only to investigate abuse.",
      "You don't get a copy, and nobody can reply to you directly.",
    ]);
  });

  it("goes back to the council page", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Back to the Student Council" }));

    expect(screen.getByText("Student Council page")).toBeTruthy();
  });

  it("counts the characters and only sends a message with text", () => {
    renderPage();

    write("   ");

    expect(screen.getByText("Characters: 3 / 5000")).toBeTruthy();
    expect(sendButton().disabled).toBe(true);

    write("The fridge is broken.");

    expect(screen.getByText("Characters: 21 / 5000")).toBeTruthy();
    expect(sendButton().disabled).toBe(false);
  });

  it("sends the trimmed message and shows the popup, which goes back to the council page", async () => {
    vi.mocked(sendSCMessage).mockResolvedValue({ id: 3, created_at: "2026-10-17T10:00:00Z" });
    renderPage();
    write("  The fridge is broken.  ");

    fireEvent.click(sendButton());

    expect(await screen.findByRole("dialog", { name: "Message Sent" })).toBeTruthy();
    expect(sendSCMessage).toHaveBeenCalledWith({ body: "The fridge is broken." });
    expect(
      screen.getByText(
        "The council members cannot reply to you directly because your identity is hidden.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("message-sent-backdrop"));

    expect(screen.getByText("Student Council page")).toBeTruthy();
  });

  it("closes the popup on Escape", async () => {
    vi.mocked(sendSCMessage).mockResolvedValue({ id: 3, created_at: "2026-10-17T10:00:00Z" });
    renderPage();
    write("Thanks for the new chairs!");
    fireEvent.click(sendButton());
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByText("Student Council page")).toBeTruthy();
  });

  it("locks the form while the message is being sent", () => {
    vi.mocked(sendSCMessage).mockReturnValue(new Promise(() => {}));
    renderPage();
    write("The fridge is broken.");

    fireEvent.click(sendButton());

    expect(sendButton("Sending…").disabled).toBe(true);
    expect(messageBox().disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Back to the Student Council" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows the field message from a 400 next to the message and keeps the text", async () => {
    vi.mocked(sendSCMessage).mockRejectedValue(
      new ApiError(400, "Invalid input.", "validation_error", {
        body: ["Ensure this field has no more than 5000 characters."],
      }),
    );
    renderPage();
    write("The fridge is broken.");

    fireEvent.click(sendButton());

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toBe("Ensure this field has no more than 5000 characters.");
    expect(messageBox().getAttribute("aria-describedby")).toBe(alert.id);
    expect(messageBox().value).toBe("The fridge is broken.");
    expect(sendButton().disabled).toBe(false);
  });

  it("explains the limit of messages per hour (429)", async () => {
    vi.mocked(sendSCMessage).mockRejectedValue(
      new ApiError(429, "Request was throttled.", "throttled"),
    );
    renderPage();
    write("One more thing…");

    fireEvent.click(sendButton());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "You have sent too many messages. Please try again later.",
    );
  });

  it("explains when the message could not be sent", async () => {
    vi.mocked(sendSCMessage).mockRejectedValue(new Error("network"));
    renderPage();
    write("The fridge is broken.");

    fireEvent.click(sendButton());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not send your message. Please try again.",
    );
  });
});
