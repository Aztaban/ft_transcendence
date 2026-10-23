import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import i18n from "../i18n";
import type { SCMessage } from "../types/scMessage";
import { formatDate, formatTimeAgo } from "../utils/dateTime";
import "../styles/council.css";

type LoadState = "loading" | "ready" | "missing" | "error";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "not_authenticated") {
      return i18n.t("council.errorSession");
    }

    if (error.code === "permission_denied") {
      return i18n.t("council.errorPermission");
    }

    return error.fields?.discussion_note?.[0] ?? error.message;
  }

  return i18n.t("council.errorSomething");
}

// One council message (#277, #278, Figma "new message" and "history review"). Opening it does
// not mark it read (api-plan §10.6): the member does, and can mark it unread again. The council
// shares one internal note per message, saved with the version it was loaded at; when another
// member saved first (409 `edit_conflict`), their note is loaded and the draft stays for merging.
// It is also the page council notifications open (`/council/inbox/{id}`, §8.8).
function CouncilInboxMessagePage() {
  const { t } = useTranslation();
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
          aria-label={t("council.backToMessages")}
          disabled={isBusy}
          onClick={() => navigate(isRead ? "/council/history" : "/council/inbox")}
        >
          ‹
        </button>
        <div>
          <h1>{t("council.messageNumber", { id })}</h1>
          {message && (
            <p className="council-meta">
              {message.read_at ? (
                <span className="council-status council-status--read">
                  {t("council.readOn", { date: formatDate(message.read_at) })}
                </span>
              ) : (
                <span className="council-status council-status--unread">{t("council.unread")}</span>
              )}
              <span className="council-meta__time">
                <ClockIcon />
                {t("council.received", { time: formatTimeAgo(message.created_at) })}
              </span>
            </p>
          )}
        </div>
      </header>

      {loadState === "loading" && (
        <div className="council-skeleton council-skeleton--tall" aria-busy="true">
          <span className="council-sr-only">{t("council.loadingMessage")}</span>
        </div>
      )}

      {loadState === "missing" && (
        <p className="council-error" role="alert">
          {t("council.missing")}
        </p>
      )}

      {loadState === "error" && (
        <p className="council-error" role="alert">
          {t("council.loadMessageError")}
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
                  <strong>{t("council.anonymous")}</strong>
                  <span>{t("council.senderHidden")}</span>
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
                  ? t("council.markedReadOn", { date: formatDate(message.read_at) })
                  : t("council.notReadYet")}
              </p>
              {isRead ? (
                <button
                  className="council-more"
                  type="button"
                  disabled={isBusy}
                  onClick={() => updateRead(false)}
                >
                  {t("council.markUnread")}
                </button>
              ) : (
                <button
                  className="council-button"
                  type="button"
                  disabled={isBusy}
                  onClick={() => updateRead(true)}
                >
                  {isUpdatingRead ? t("council.saving") : t("council.markRead")}{" "}
                  <span aria-hidden="true">✓</span>
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
                  {t("council.noteTitle")}
                </h2>
                <span className="council-pill council-pill--muted">{t("council.internal")}</span>
              </div>
              <p>{t("council.noteHint")}</p>

              {noteStatus === "conflict" && (
                <div className="council-conflict" role="alert">
                  <strong>{t("council.conflictTitle")}</strong>
                  <p>{t("council.conflictTheirs")}</p>
                  <blockquote>{message.discussion_note || t("council.empty")}</blockquote>
                  <p>{t("council.conflictMerge")}</p>
                </div>
              )}

              <textarea
                aria-label={t("council.noteTitle")}
                value={note}
                maxLength={SC_NOTE_MAX_LENGTH}
                rows={6}
                placeholder={t("council.notePlaceholder")}
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
                    {t("council.saved")}
                  </span>
                )}
                <button
                  className="council-more"
                  type="button"
                  disabled={!noteChanged || isBusy}
                  onClick={saveNote}
                >
                  {isSavingNote ? t("council.saving") : t("council.saveNote")}
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
