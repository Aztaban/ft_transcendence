import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { getAdminUser, updateAdminUser, type UpdateAdminUserPayload } from "../api/admin";
import { ApiError } from "../api/client";
import usePageTitle from "../components/layout/usePageTitle";
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
// and a form that changes the display name, email and language with PATCH. Deleted accounts are
// shown but cannot be edited. App.tsx gives each id its own instance, so nothing typed for one
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

  // Typing again hides "Changes saved." and the error of that field.
  function edited(field: keyof UpdateAdminUserPayload) {
    setIsSaved(false);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  if (loadState === "not-found") {
    return <NotFoundPage />;
  }

  const hasChanges = user !== null && Object.keys(changes(user)).length > 0;

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
        </>
      )}
    </section>
  );
}

export default AdminUserDetailPage;
