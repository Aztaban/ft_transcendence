import { useState } from "react";
import { useNavigate } from "react-router";

import { ApiError } from "../api/client";
import { SC_MESSAGE_MAX_LENGTH, sendSCMessage } from "../api/scMessages";
import councilIcon from "../assets/figma/student-council.svg";
import MessageSentDialog from "../features/council/MessageSentDialog";
import "../styles/council.css";

// The character meter turns amber when the message gets close to the limit.
const NEARLY_FULL = 0.9;

const privacyPoints = [
  "The council never sees who wrote the message.",
  "Your identity is stored only to investigate abuse.",
  "You don't get a copy, and nobody can reply to you directly.",
];

function sendErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "throttled") {
      return "You have sent too many messages. Please try again later.";
    }

    if (error.code === "not_authenticated") {
      return "Your session has expired. Please log in again.";
    }

    return error.fields?.body?.[0] ?? error.message;
  }

  return "Could not send your message. Please try again.";
}

// Anonymous message to the Student Council (#276, Figma "Message"). The sender is stored only
// for abuse investigation and never shown to the council (api-plan §7.3, §10.6).
function CouncilMessagePage() {
  const navigate = useNavigate();
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [isSent, setIsSent] = useState(false);

  const message = body.trim();
  const fill = body.length / SC_MESSAGE_MAX_LENGTH;

  async function handleSend() {
    setSendError("");
    setIsSending(true);

    try {
      await sendSCMessage({ body: message });
      setIsSent(true);
    } catch (error) {
      setSendError(sendErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="council-message">
      <header className="council-header council-header--back">
        <button
          className="council-back"
          type="button"
          aria-label="Back to the Student Council"
          disabled={isSending}
          onClick={() => navigate("/council")}
        >
          ‹
        </button>
        <div>
          <h1>Anonymous Message</h1>
          <p className="council-privacy">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
              <path className="council-privacy__tick" d="m8.5 12 2.5 2.5 4.5-5" />
            </svg>
            <span>
              Your identity will NOT be shared with the council members. It is stored only to
              investigate abuse.
            </span>
          </p>
        </div>
      </header>

      <div className="council-layout">
        <div className="council-message__body">
          <div className="council-card">
            <div className="council-recipient">
              <span className="council-recipient__icon" aria-hidden="true">
                <img src={councilIcon} alt="" />
              </span>
              <p>
                <span>Recipient</span>
                <strong>Student Council</strong>
              </p>
            </div>

            <div className="council-message__box">
              <textarea
                id="council-message-body"
                aria-label="Your message to the Student Council"
                aria-describedby={sendError ? "council-message-error" : undefined}
                value={body}
                maxLength={SC_MESSAGE_MAX_LENGTH}
                rows={8}
                placeholder="Write your message…"
                disabled={isSending}
                onChange={(event) => setBody(event.target.value)}
              />
              <div className="council-message__footer">
                <span className="council-message__count" aria-live="polite">
                  Characters: {body.length} / {SC_MESSAGE_MAX_LENGTH}
                </span>
                <span
                  className={`council-meter${fill >= NEARLY_FULL ? " council-meter--full" : ""}`}
                  aria-hidden="true"
                >
                  <span style={{ width: `${Math.min(fill, 1) * 100}%` }} />
                </span>
              </div>
            </div>
          </div>

          {sendError && (
            <p id="council-message-error" className="council-error" role="alert">
              {sendError}
            </p>
          )}

          <aside className="council-notice">
            <span className="council-notice__icon" aria-hidden="true">
              i
            </span>
            <p>
              Please be respectful.
              <br />
              Abusive messages may be ignored.
            </p>
          </aside>

          <div className="council-actions">
            <button
              className="council-button council-button--send"
              type="button"
              disabled={message.length === 0 || isSending}
              onClick={handleSend}
            >
              {isSending ? (
                <>
                  <span className="council-spinner" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                <>
                  Send Message
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 11.5 21 3l-8.5 18-2-7.5L3 11.5Z" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        <aside className="council-aside">
          <section className="council-panel">
            <h2>Your privacy</h2>
            <ul className="council-checks">
              {privacyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>

          <section className="council-panel council-panel--tip">
            <h2>Tip</h2>
            <p>You can send up to 10 messages per hour, so put everything in one message.</p>
          </section>
        </aside>
      </div>

      {isSent && <MessageSentDialog onClose={() => navigate("/council")} />}
    </section>
  );
}

export default CouncilMessagePage;
