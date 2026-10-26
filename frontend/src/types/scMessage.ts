// Shapes from docs/api-plan.md §8.10 and §10.6.

// A council message as SC Members and Admins see it. Never contains anything that identifies
// the sender.
export interface SCMessage {
  id: number;
  body: string;
  // null = unread. Shared by all council members.
  read_at: string | null;
  // Internal note shared by the council, never shown to the sender.
  discussion_note: string;
  // Goes up by one on every note change; send it back when saving the note.
  discussion_note_version: number;
  created_at: string;
}

// The sender never gets the message back: sending answers only with its id and time.
export interface SCMessageReceipt {
  id: number;
  created_at: string;
}
