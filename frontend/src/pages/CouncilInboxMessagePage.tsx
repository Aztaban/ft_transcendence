import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ApiError } from "../api/client";
import {
  getSCMessage,
  saveSCMessageNote,
  SC_NOTE_MAX_LENGTH,
  setSCMessageRead,
} from "../api/scMessages";
import AnonymousIcon from "../features/council/AnonymousIcon";
import ClockIcon from "../features/council/ClockIcon";
import MarkedReadDialog from "../features/council/MarkedReadDialog";
import type { SCMessage } from "../types/scMessage";
import { formatDate, formatTimeAgo } from "../utils/dateTime";
import "../styles/council.css";

type LoadState = "loading" | "ready" | "missing" | "error";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "not_authenticated") {
      return "Your session has expired. Please log in again.";
    }

    if (error.code === "permission_denied") {
      return "Only Student Council members can manage messages.";
    }

    return error.fields?.discussion_note?.[0] ?? error.message;
  }

  return "Something went wrong. Please try again.";
}

// One council message (#277, #278, Figma "new message" and "history review"). Opening it does
// not mark it read (api-plan §10.6): the member does, and can mark it unread again. The council
// shares one internal note per message, saved with the version it was loaded at; when another
// member saved first (409 `edit_conflict`), their note is loaded and the draft stays for merging.
// It is also the page council notifications open (`/council/inbox/{id}`, §8.8).
function CouncilInboxMessagePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState<SCMessage | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [isUpdatingRead, setIsUpdatingRead] = useState(false);
  const [readError, setReadError] = useState("");
  const [isMarkedRead, setIsMarkedRead] = useState(false);
  const [note, setNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteStatus, setNoteStatus] = useState<"" | "saved" | "conflict">("");
  const [noteError, setNoteError] = useState("");

  useEffect(() => {
    let active = true;

    setLoadState("loading");
    getSCMessage(Number(id))
      .then((result) => {
        if (active) {
          setMessage(result);
          setNote(result.discussion_note);
          setLoadState("ready");
        }
      })
      .catch((error) => {
        if (active) {
          setLoadState(error instanceof ApiError && error.status === 404 ? "missing" : "error");
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function updateRead(isRead: boolean) {
    if (!message) {
      return;
    }

    setReadError("");
    setIsUpdatingRead(true);

    try {
      const updated = await setSCMessageRead(message.id, isRead);

      setMessage(updated);
      setIsMarkedRead(isRead);
    } catch (error) {
      setReadError(actionErrorMessage(error));
    } finally {
      setIsUpdatingRead(false);
    }
  }

  async function saveNote() {
    if (!message) {
      return;
    }

    setNoteError("");
    setNoteStatus("");
    setIsSavingNote(true);

    try {
      const updated = await saveSCMessageNote(message.id, note, message.discussion_note_version);

      setMessage(updated);
      setNote(updated.discussion_note);
      setNoteStatus("saved");
    } catch (error) {
      if (error instanceof ApiError && error.code === "edit_conflict") {
        // Load the note the other member saved (and its version); keep this draft to merge.
        try {
          setMessage(await getSCMessage(message.id));
          setNoteStatus("conflict");
        } catch (reloadError) {
          setNoteError(actionErrorMessage(reloadError));
        }
      } else {
        setNoteError(actionErrorMessage(error));
      }
    } finally {
      setIsSavingNote(false);
    }
  }

  const isRead = message?.read_at != null;
  const isBusy = isUpdatingRead || isSavingNote;
  const noteChanged = message !== null && note !== message.discussion_note;

  return (
    <section className="council-message">
      <header className="council-header council-header--back">
        <button
          className="council-back"
          type="button"
          aria-label="Back to the messages"
          disabled={isBusy}
          onClick={() => navigate(isRead ? "/council/history" : "/council/inbox")}
        >
          ‹
        </button>
        <div>
          <h1>Message #{id}</h1>
          {message && (
            <p className="council-meta">
              {message.read_at ? (
                <span className="council-status council-status--read">
                  Read {formatDate(message.read_at)}
                </span>
              ) : (
                <span className="council-status council-status--unread">Unread</span>
              )}
              <span className="council-meta__time">
                <ClockIcon />
                Received {formatTimeAgo(message.created_at)}
              </span>
            </p>
          )}
        </div>
      </header>

      {loadState === "loading" && (
        <div className="council-skeleton council-skeleton--tall" aria-busy="true">
          <span className="council-sr-only">Loading the message…</span>
        </div>
      )}

      {loadState === "missing" && (
        <p className="council-error" role="alert">
          This message does not exist or was removed.
        </p>
      )}

      {loadState === "error" && (
        <p className="council-error" role="alert">
          Could not load the message. Please try again later.
        </p>
      )}

      {loadState === "ready" && message && (
        <div className="council-layout">
          <div className="council-message__body">
            <article className="council-card council-letter">
              <p className="council-letter__from">
                <span className="council-item__icon">
                  <AnonymousIcon />
                </span>
                <span>
                  <strong>Anonymous</strong>
                  <span>Sender hidden from the council</span>
                </span>
              </p>
              <p className="council-letter__text">{message.body}</p>
            </article>

            {readError && (
              <p className="council-error" role="alert">
                {readError}
              </p>
            )}

            <div className="council-actions council-actions--between council-actionbar">
              <p className="council-read-state">
                {message.read_at
                  ? `Marked as read, ${formatDate(message.read_at)}`
                  : "Not read by the council yet"}
              </p>
              {isRead ? (
                <button
                  className="council-more"
                  type="button"
                  disabled={isBusy}
                  onClick={() => updateRead(false)}
                >
                  Mark as unread
                </button>
              ) : (
                <button
                  className="council-button"
                  type="button"
                  disabled={isBusy}
                  onClick={() => updateRead(true)}
                >
                  {isUpdatingRead ? "Saving…" : "Mark as read"} <span aria-hidden="true">✓</span>
                </button>
              )}
            </div>
          </div>

          <aside className="council-aside">
            <section className="council-panel council-note">
              <div className="council-note__head">
                <h2>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  Council note
                </h2>
                <span className="council-pill council-pill--muted">Internal</span>
              </div>
              <p>Shared by all council members. Never shown to the sender.</p>

              {noteStatus === "conflict" && (
                <div className="council-conflict" role="alert">
                  <strong>Another council member saved the note in the meantime.</strong>
                  <p>Their version:</p>
                  <blockquote>{message.discussion_note || "(empty)"}</blockquote>
                  <p>Your text is still in the box. Merge it and save again.</p>
                </div>
              )}

              <textarea
                aria-label="Council note"
                value={note}
                maxLength={SC_NOTE_MAX_LENGTH}
                rows={6}
                placeholder="e.g. Forwarded to the building manager."
                disabled={isSavingNote}
                onChange={(event) => {
                  setNote(event.target.value);
                  setNoteStatus((status) => (status === "saved" ? "" : status));
                }}
              />
              <span className="council-message__count">
                {note.length} / {SC_NOTE_MAX_LENGTH}
              </span>

              {noteError && (
                <p className="council-error" role="alert">
                  {noteError}
                </p>
              )}

              <div className="council-note__actions">
                {noteStatus === "saved" && (
                  <span className="council-saved" role="status">
                    Saved ✓
                  </span>
                )}
                <button
                  className="council-more"
                  type="button"
                  disabled={!noteChanged || isBusy}
                  onClick={saveNote}
                >
                  {isSavingNote ? "Saving…" : "Save note"}
                </button>
              </div>
            </section>
          </aside>
        </div>
      )}

      {isMarkedRead && <MarkedReadDialog onClose={() => navigate("/council/inbox")} />}
    </section>
  );
}

export default CouncilInboxMessagePage;
