import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import usePageTitle from "../components/layout/usePageTitle";
import i18n from "../i18n";
import { ApiError } from "../api/client";
import { Avatar, Button, Input } from "../components/ui";
import { useCurrentUser } from "../store/CurrentUserContext";
import type { Language, UserRole } from "../types/user";
import { DISPLAY_NAME_MAX_LENGTH } from "../utils/validation";
import "../styles/profile.css";

const languages: Language[] = ["en", "cs", "es"];

// The language's name in the language the page is shown in, e.g. "Czech" or "Čeština".
function languageLabel(language: Language) {
  return i18n.t(`profile.languageNames.${language}`);
}

// Role names are translated under "roles", e.g. `tutor` → "Hitchhiker".
function formatRole(role: UserRole) {
  return i18n.t(`roles.${role.name}`);
}

// Small line icons for the info tiles (decorative).
const icons: Record<"mail" | "globe" | "key" | "shield", ReactNode> = {
  mail: <path d="M4 6h16v12H4zM4 7l8 6 8-6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.5 2.6 2.5 13.4 0 16M12 4c-2.5 2.6-2.5 13.4 0 16" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="14" r="4" />
      <path d="M11 11l8-8M16 6l2 2M14 8l2 2" />
    </>
  ),
  shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
};

interface InfoTile {
  key: string;
  label: string;
  value: string;
  icon: keyof typeof icons;
}

function ProfilePage() {
  const { t } = useTranslation();

  usePageTitle(t("nav.profile"));
  // The profile is the shared one: the context loads it, follows `role.changed` and re-fetches
  // after every save, so the top bar and this page can never disagree (#776).
  const { user: profile, loadFailed, update } = useCurrentUser();
  const isLoading = !profile && !loadFailed;

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // The language picked but not saved yet; `null` shows the saved one.
  const [draftLanguage, setDraftLanguage] = useState<Language | null>(null);
  const settingsLanguage: Language = draftLanguage ?? profile?.language ?? "en";

  // A change of the saved language, here or in the top bar, drops the pick: otherwise Save would
  // write the stale pick over the top bar's choice.
  useEffect(() => setDraftLanguage(null), [profile?.language]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  function startEditing() {
    if (!profile) return;

    setDisplayName(profile.display_name);
    setFormError("");
    setSaveMessage("");
    setIsEditing(true);
  }

  function cancelEditing() {
    if (profile) {
      setDisplayName(profile.display_name);
    }

    setFormError("");
    setIsEditing(false);
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDisplayName = displayName.trim();

    if (!trimmedDisplayName) {
      setFormError(t("profile.nameRequired"));
      return;
    }

    if (trimmedDisplayName.length > DISPLAY_NAME_MAX_LENGTH) {
      setFormError(t("profile.nameTooLong", { max: DISPLAY_NAME_MAX_LENGTH }));
      return;
    }

    setFormError("");
    setSaveMessage("");
    setIsSaving(true);

    try {
      await update({ display_name: trimmedDisplayName });

      setIsEditing(false);
      setSaveMessage(t("profile.updated"));
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(
          error.fields?.display_name?.[0] ?? error.fields?.language?.[0] ?? error.message,
        );
      } else {
        setFormError(t("profile.saveError"));
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSettingsError("");
    setSettingsMessage("");
    setIsSavingSettings(true);

    try {
      // The context switches the page to the saved language once it has re-fetched.
      await update({ language: settingsLanguage });

      setSettingsMessage(t("profile.settingsUpdated"));
    } catch (error) {
      if (error instanceof ApiError) {
        setSettingsError(error.fields?.language?.[0] ?? error.message);
      } else {
        setSettingsError(t("profile.settingsError"));
      }
    } finally {
      setIsSavingSettings(false);
    }
  }

  const tiles: InfoTile[] = profile
    ? [
        { key: "email", label: t("profile.email"), value: profile.email, icon: "mail" },
        {
          key: "language",
          label: t("profile.language"),
          value: languageLabel(profile.language),
          icon: "globe",
        },
        {
          key: "sign-in",
          label: t("profile.signsInWith"),
          value: profile.intra_login
            ? t("profile.intraAccount", { login: profile.intra_login })
            : t("profile.emailPassword"),
          icon: "key",
        },
        {
          key: "roles",
          label: t("profile.roles", { count: profile.roles.length }),
          value: profile.roles.map(formatRole).join(", ") || t("roles.student"),
          icon: "shield",
        },
      ]
    : [];

  return (
    <section className="profile-page">
      {isLoading && (
        <div className="profile-hero profile-hero--loading" aria-busy="true">
          <span className="profile-page__sr-only">{t("profile.loading")}</span>
        </div>
      )}

      {!isLoading && !profile && (
        <div className="profile-page__message" role="alert">
          {t("profile.unavailable")}
        </div>
      )}

      {!isLoading && profile && (
        <>
          <section className="profile-hero" aria-labelledby="profile-name">
            <div className="profile-hero__body">
              <Avatar
                className="profile-card__avatar"
                name={profile.display_name}
                avatarUrl={profile.avatar_url ?? null}
              />

              <div className="profile-hero__identity">
                <p className="profile-page__eyebrow">{t("profile.eyebrow")}</p>
                <h1 id="profile-name">{profile.display_name}</h1>
                <ul className="profile-hero__roles" aria-label={t("profile.rolesAria")}>
                  {profile.roles.map((role, index) => (
                    <li
                      key={role.id}
                      className={`profile-role profile-role--${role.name}`}
                      style={{ "--index": index } as CSSProperties}
                    >
                      {formatRole(role)}
                    </li>
                  ))}
                </ul>
              </div>

              {!isEditing && (
                <Button className="profile-hero__edit" variant="secondary" onClick={startEditing}>
                  {t("profile.edit")}
                </Button>
              )}
            </div>

            {saveMessage && (
              <p className="profile-page__success" role="status">
                <span aria-hidden="true">✓</span> {saveMessage}
              </p>
            )}
          </section>

          {isEditing && (
            <form className="profile-edit" onSubmit={handleProfileSubmit}>
              <h2>{t("profile.editTitle")}</h2>
              <Input
                id="profile-display-name"
                label={t("profile.displayName")}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                autoComplete="username"
              />

              {formError && (
                <p className="profile-page__error" role="alert">
                  {formError}
                </p>
              )}

              <div className="profile-page__actions">
                <Button type="button" variant="ghost" onClick={cancelEditing} disabled={isSaving}>
                  {t("common.cancel")}
                </Button>

                <Button type="submit" disabled={isSaving}>
                  {isSaving ? t("profile.saving") : t("profile.saveChanges")}
                </Button>
              </div>
            </form>
          )}

          <ul className="profile-tiles" aria-label={t("profile.accountDetails")}>
            {tiles.map((tile, index) => (
              <li
                key={tile.key}
                className="profile-tile"
                style={{ "--index": index } as CSSProperties}
              >
                <span className="profile-tile__icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {icons[tile.icon]}
                  </svg>
                </span>
                <span className="profile-tile__label">{tile.label}</span>
                <span className="profile-tile__value">{tile.value}</span>
              </li>
            ))}
          </ul>

          <section className="profile-settings" aria-labelledby="profile-settings-title">
            <div className="profile-settings__header">
              <div>
                <p className="profile-page__eyebrow">{t("profile.preferences")}</p>
                <h2 id="profile-settings-title">{t("profile.language")}</h2>
                <p className="profile-settings__hint">{t("profile.languageHint")}</p>
              </div>
            </div>

            <form className="profile-settings__form" onSubmit={handleSettingsSubmit}>
              <fieldset className="profile-languages">
                <legend className="profile-page__sr-only">{t("profile.language")}</legend>
                {languages.map((language) => (
                  <label
                    key={language}
                    className={
                      settingsLanguage === language
                        ? "profile-language profile-language--active"
                        : "profile-language"
                    }
                  >
                    <input
                      type="radio"
                      name="profile-language"
                      value={language}
                      checked={settingsLanguage === language}
                      onChange={() => setDraftLanguage(language)}
                    />
                    <span className="profile-language__code" aria-hidden="true">
                      {language.toUpperCase()}
                    </span>
                    {languageLabel(language)}
                  </label>
                ))}
              </fieldset>

              {settingsError && (
                <p className="profile-page__error" role="alert">
                  {settingsError}
                </p>
              )}

              {settingsMessage && (
                <p className="profile-page__success" role="status">
                  <span aria-hidden="true">✓</span> {settingsMessage}
                </p>
              )}

              <div className="profile-page__actions">
                <Button type="submit" disabled={isSavingSettings}>
                  {isSavingSettings ? t("profile.saving") : t("profile.saveSettings")}
                </Button>
              </div>
            </form>
          </section>
        </>
      )}
    </section>
  );
}

export default ProfilePage;
