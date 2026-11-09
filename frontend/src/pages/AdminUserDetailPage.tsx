import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import {
  deleteAdminUser,
  getAdminUser,
  reactivateAdminUser,
  suspendAdminUser,
  updateAdminUser,
  type UpdateAdminUserPayload,
} from "../api/admin";
import { ApiError } from "../api/client";
import usePageTitle from "../components/layout/usePageTitle";
import AccountActionDialog, { type AccountAction } from "../features/admin/AccountActionDialog";
import UserStatusBadge, { rolesText } from "../features/admin/UserStatusBadge";
import { useCurrentUser } from "../store/CurrentUserContext";
import type { AdminUser } from "../types/adminUser";
import type { Language } from "../types/user";
import { formatDate } from "../utils/dateTime";
import { DISPLAY_NAME_MAX_LENGTH, EMAIL_MAX_LENGTH } from "../utils/validation";
import NotFoundPage from "./NotFoundPage";
import "../styles/admin-users.css";

type LoadState = "loading" | "ready" | "not-found" | "error";
type FieldErrors = Partial<Record<keyof UpdateAdminUserPayload, string>>;

const languages: readonly Language[] = ["en", "cs", "es"];

// Only a plain positive number is a user id: "1e1", "0x9" or "007" would load another user than
// the URL names, so they show the not found page.
const USER_ID_PATTERN = /^[1-9]\d*$/;

// Administration user detail (#678): one AdminUser from GET /admin/users/{id}/ (api-plan §10.2),
// a form that changes the display name, email and language with PATCH, and the buttons that
// suspend, reactivate or delete the account, each confirmed with a reason. Deleted accounts are
// shown but cannot be changed. App.tsx gives each id its own instance, so nothing typed for one
// user carries over to the next.
function AdminUserDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const userId = USER_ID_PATTERN.test(id) ? Number(id) : null;
  const { user: me, refresh: refreshMe } = useCurrentUser();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(userId ? "loading" : "not-found");
  // Bumped to load the user again, e.g. after a 409 says the account changed meanwhile.
  const [reloadKey, setReloadKey] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  // The account action whose popup is open, and what the last one did.
  const [action, setAction] = useState<AccountAction | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionDone, setActionDone] = useState<AccountAction | null>(null);
  const actionDoneRef = useRef<HTMLParagraphElement>(null);

  usePageTitle(user?.display_name ?? t("adminUser.title"));

  // Shows the account and puts its current values in the form.
  function show(next: AdminUser) {
    setUser(next);
    setDisplayName(next.display_name);
    setEmail(next.email);
    setLanguage(next.language);
  }

  useEffect(() => {
    if (!userId) {
      return;
    }

    let active = true;

    getAdminUser(userId)
      .then((result) => {
        if (active) {
          show(result);
          setLoadState("ready");
        }
      })
      .catch((error) => {
        if (active) {
          setLoadState(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
        }
      });

    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  // The button that opened the popup is gone after the action (Suspend becomes Reactivate, a
  // deleted account has no buttons), so the focus moves to the result instead of the page top.
  useEffect(() => {
    if (actionDone) {
      actionDoneRef.current?.focus();
    }
  }, [actionDone]);

  // Only what differs from the saved account is sent (a partial PATCH), trimmed like the backend.
  function changes(current: AdminUser): UpdateAdminUserPayload {
    const payload: UpdateAdminUserPayload = {};

    if (displayName.trim() !== current.display_name) {
      payload.display_name = displayName.trim();
    }

    if (email.trim() !== current.email) {
      payload.email = email.trim();
    }

    if (language !== current.language) {
      payload.language = language;
    }

    return payload;
  }

  // The rules the page can check itself; the email format is left to the backend, whose message
  // is shown next to the field.
  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const name = displayName.trim();
    const address = email.trim();

    if (!name) {
      errors.display_name = t("validation.displayNameRequired");
    } else if (name.length > DISPLAY_NAME_MAX_LENGTH) {
      errors.display_name = t("validation.displayNameTooLong", { max: DISPLAY_NAME_MAX_LENGTH });
    }

    if (!address) {
      errors.email = t("validation.emailRequired");
    } else if (address.length > EMAIL_MAX_LENGTH) {
      errors.email = t("validation.emailTooLong", { max: EMAIL_MAX_LENGTH });
    }

    return errors;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      return;
    }

    const errors = validate();
    const payload = changes(user);

    setFieldErrors(errors);
    setFormError("");
    setIsSaved(false);

    if (Object.keys(errors).length > 0 || Object.keys(payload).length === 0) {
      return;
    }

    setIsSaving(true);

    try {
      const updated = await updateAdminUser(user.id, payload);

      show(updated);
      setIsSaved(true);

      // An Admin editing their own account: the top bar and the language follow the change.
      if (me?.id === updated.id) {
        refreshMe();
      }
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setFormError(t("adminUser.saveError"));
      } else if (error.code === "email_already_exists") {
        setFieldErrors({ email: t("adminUser.emailTaken") });
      } else if (error.code === "invalid_user_status") {
        // Deleted meanwhile: load it again, which hides the form.
        setFormError(t("adminUser.deletedMeanwhile"));
        setReloadKey((key) => key + 1);
      } else if (error.status === 404) {
        setLoadState("not-found");
      } else if (error.code === "validation_error" && error.fields) {
        const serverErrors: FieldErrors = {
          display_name: error.fields.display_name?.[0],
          email: error.fields.email?.[0],
          language: error.fields.language?.[0],
        };

        setFieldErrors(serverErrors);

        if (!Object.values(serverErrors).some(Boolean)) {
          setFormError(error.message);
        }
      } else {
        setFormError(t("adminUser.saveError"));
      }
    } finally {
      setIsSaving(false);
    }
  }

  function openAction(next: AccountAction) {
    setAction(next);
    setActionError("");
    setActionDone(null);
  }

  // The popup stays open while its request runs.
  function closeAction() {
    if (!isActing) {
      setAction(null);
      setActionError("");
    }
  }

  async function confirmAction(reason: string) {
    if (!user || !action) {
      return;
    }

    setActionError("");
    setIsActing(true);

    try {
      if (action === "delete") {
        // 204 with no body: load the anonymized account (schema §2.4) to show it.
        await deleteAdminUser(user.id, reason);
        setReloadKey((key) => key + 1);
      } else {
        const updated =
          action === "suspend"
            ? await suspendAdminUser(user.id, reason)
            : await reactivateAdminUser(user.id, reason);

        // Only the account changes: what is typed in the edit form stays.
        setUser(updated);
      }

      setAction(null);
      setActionDone(action);
    } catch (error) {
      if (error instanceof ApiError && error.code === "invalid_user_status") {
        // Another Admin changed the status first: show the account as it is now.
        setAction(null);
        setFormError(t("adminUser.actions.statusChanged"));
        setReloadKey((key) => key + 1);
      } else if (error instanceof ApiError && error.status === 404) {
        setAction(null);
        setLoadState("not-found");
      } else if (error instanceof ApiError && error.code === "cannot_modify_self") {
        setActionError(t("adminUser.actions.cannotModifySelf"));
      } else if (error instanceof ApiError && error.code === "validation_error") {
        setActionError(error.fields?.reason?.[0] ?? error.message);
      } else {
        setActionError(t("adminUser.actions.error"));
      }
    } finally {
      setIsActing(false);
    }
  }

  // Typing again hides "Changes saved." and the error of that field.
  function edited(field: keyof UpdateAdminUserPayload) {
    setIsSaved(false);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  if (loadState === "not-found") {
    return <NotFoundPage />;
  }

  const hasChanges = user !== null && Object.keys(changes(user)).length > 0;
  // The backend refuses an Admin's own account (409 `cannot_modify_self`), so no buttons for it.
  const isOwnAccount = user !== null && me?.id === user.id;

  return (
    <section className="admin-users admin-user">
      <Link className="admin-user__back" to="/manage/users">
        <span aria-hidden="true">‹</span> {t("adminUser.back")}
      </Link>

      {loadState === "loading" && (
        <div className="admin-users__list" aria-busy="true">
          <div className="admin-users__skeleton" />
          <span className="admin-users__sr-only">{t("adminUser.loading")}</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="admin-users__error" role="alert">
          {t("adminUser.loadError")}
        </p>
      )}

      {loadState === "ready" && user && (
        <>
          <header className="admin-user__header">
            <h1>{user.display_name}</h1>
            <UserStatusBadge status={user.status} />
          </header>

          {actionDone && (
            <p className="admin-user__result" role="status" tabIndex={-1} ref={actionDoneRef}>
              {t(`adminUser.actions.${actionDone}Done`)}
            </p>
          )}

          <dl className="admin-user__details">
            <div>
              <dt>{t("adminUser.email")}</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>{t("adminUser.intraLogin")}</dt>
              <dd>{user.intra_login ?? "—"}</dd>
            </div>
            <div>
              <dt>{t("adminUser.language")}</dt>
              <dd>{t(`profile.languageNames.${user.language}`)}</dd>
            </div>
            <div>
              <dt>{t("adminUser.roles")}</dt>
              <dd>{rolesText(user)}</dd>
            </div>
            <div>
              <dt>{t("adminUser.createdAt")}</dt>
              <dd>
                <time dateTime={user.created_at}>{formatDate(user.created_at)}</time>
              </dd>
            </div>
            <div>
              <dt>{t("adminUser.lastLogin")}</dt>
              <dd>
                {user.last_login ? (
                  <time dateTime={user.last_login}>{formatDate(user.last_login)}</time>
                ) : (
                  t("adminUsers.never")
                )}
              </dd>
            </div>
          </dl>

          {formError && (
            <p className="admin-users__error" role="alert">
              {formError}
            </p>
          )}

          {user.status === "deleted" ? (
            <p className="admin-user__note">{t("adminUser.deletedNote")}</p>
          ) : (
            // The page checks the fields itself (noValidate), so the messages are translated and
            // look the same in every browser (#683).
            <form
              className="admin-user__form"
              noValidate
              aria-labelledby="admin-user-edit-title"
              onSubmit={save}
            >
              <h2 id="admin-user-edit-title">{t("adminUser.editTitle")}</h2>

              <div className="admin-user__field">
                <label htmlFor="admin-user-name">{t("adminUser.displayName")}</label>
                <input
                  id="admin-user-name"
                  value={displayName}
                  maxLength={DISPLAY_NAME_MAX_LENGTH}
                  aria-invalid={fieldErrors.display_name ? true : undefined}
                  aria-describedby={fieldErrors.display_name ? "admin-user-name-error" : undefined}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    edited("display_name");
                  }}
                />
                {fieldErrors.display_name && (
                  <p className="admin-user__field-error" id="admin-user-name-error">
                    {fieldErrors.display_name}
                  </p>
                )}
              </div>

              <div className="admin-user__field">
                <label htmlFor="admin-user-email">{t("adminUser.email")}</label>
                <input
                  id="admin-user-email"
                  type="email"
                  value={email}
                  maxLength={EMAIL_MAX_LENGTH}
                  aria-invalid={fieldErrors.email ? true : undefined}
                  aria-describedby={fieldErrors.email ? "admin-user-email-error" : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    edited("email");
                  }}
                />
                {fieldErrors.email && (
                  <p className="admin-user__field-error" id="admin-user-email-error">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="admin-user__field">
                <label htmlFor="admin-user-language">{t("adminUser.language")}</label>
                <select
                  id="admin-user-language"
                  value={language}
                  aria-invalid={fieldErrors.language ? true : undefined}
                  aria-describedby={fieldErrors.language ? "admin-user-language-error" : undefined}
                  onChange={(event) => {
                    setLanguage(
                      languages.find((value) => value === event.target.value) ?? user.language,
                    );
                    edited("language");
                  }}
                >
                  {languages.map((value) => (
                    <option key={value} value={value}>
                      {t(`profile.languageNames.${value}`)}
                    </option>
                  ))}
                </select>
                {fieldErrors.language && (
                  <p className="admin-user__field-error" id="admin-user-language-error">
                    {fieldErrors.language}
                  </p>
                )}
              </div>

              <div className="admin-user__actions">
                <button type="submit" disabled={!hasChanges || isSaving}>
                  {isSaving ? t("adminUser.saving") : t("adminUser.save")}
                </button>
                {isSaved && (
                  <p className="admin-user__saved" role="status">
                    {t("adminUser.saved")}
                  </p>
                )}
              </div>
            </form>
          )}

          {user.status !== "deleted" && (
            <section className="admin-user__account" aria-labelledby="admin-user-actions-title">
              <h2 id="admin-user-actions-title">{t("adminUser.actions.title")}</h2>

              {isOwnAccount ? (
                <p className="admin-user__note">{t("adminUser.actions.ownAccount")}</p>
              ) : (
                <div className="admin-user__account-buttons">
                  {user.status === "active" ? (
                    <button type="button" onClick={() => openAction("suspend")}>
                      {t("adminUser.actions.suspend")}
                    </button>
                  ) : (
                    <button type="button" onClick={() => openAction("reactivate")}>
                      {t("adminUser.actions.reactivate")}
                    </button>
                  )}
                  <button
                    className="admin-user__delete"
                    type="button"
                    onClick={() => openAction("delete")}
                  >
                    {t("adminUser.actions.delete")}
                  </button>
                </div>
              )}
            </section>
          )}

          {action && (
            <AccountActionDialog
              action={action}
              name={user.display_name}
              isSubmitting={isActing}
              error={actionError}
              onConfirm={confirmAction}
              onClose={closeAction}
            />
          )}
        </>
      )}
    </section>
  );
}

export default AdminUserDetailPage;
