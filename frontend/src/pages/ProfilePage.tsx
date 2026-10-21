import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

import { getCurrentUser, updateCurrentUser } from "../api/users";
import { ApiError } from "../api/client";
import { Button, Input } from "../components/ui";
import PersonAvatar from "../features/people/PersonAvatar";
import type { Language, RoleName, UserProfile, UserRole } from "../types/user";
import { DISPLAY_NAME_MAX_LENGTH } from "../utils/validation";
import { useLiveRefresh } from "../websocket/LiveProvider";
import "../styles/profile.css";

const languageLabels: Record<Language, string> = {
  en: "English",
  cs: "Czech",
  es: "Spanish",
};

const languages: Language[] = ["en", "cs", "es"];

const roleLabels: Record<RoleName, string> = {
  student: "Student",
  tutor: "Hitchhiker",
  head_tutor: "Head Tutor",
  sc_member: "Student Council",
  admin: "Admin",
};

function formatRole(role: UserRole) {
  return roleLabels[role.name];
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [settingsLanguage, setSettingsLanguage] = useState<Language>("en");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((data) => {
        if (active) {
          setProfile(data);
          setDisplayName(data.display_name);
          setSettingsLanguage(data.language);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // §9.3 `role.changed`: re-fetch the roles shown here. The form fields being edited are kept.
  useLiveRefresh(["role.changed"], () => {
    getCurrentUser()
      .then((data) => setProfile(data))
      .catch(() => {
        // The roles shown stay as they were; the next page load gets them.
      });
  });

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
      setFormError("Display name is required.");
      return;
    }

    if (trimmedDisplayName.length > DISPLAY_NAME_MAX_LENGTH) {
      setFormError(`Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`);
      return;
    }

    setFormError("");
    setSaveMessage("");
    setIsSaving(true);

    try {
      await updateCurrentUser({
        display_name: trimmedDisplayName,
      });

      const updatedProfile = await getCurrentUser();

      setProfile(updatedProfile);
      setDisplayName(updatedProfile.display_name);
      setSettingsLanguage(updatedProfile.language);
      setIsEditing(false);
      setSaveMessage("Profile updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(
          error.fields?.display_name?.[0] ?? error.fields?.language?.[0] ?? error.message,
        );
      } else {
        setFormError("Unable to save profile changes.");
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
      await updateCurrentUser({
        language: settingsLanguage,
      });

      const updatedProfile = await getCurrentUser();

      setProfile(updatedProfile);
      setSettingsLanguage(updatedProfile.language);
      setSettingsMessage("Settings updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        setSettingsError(error.fields?.language?.[0] ?? error.message);
      } else {
        setSettingsError("Unable to save settings.");
      }
    } finally {
      setIsSavingSettings(false);
    }
  }

  const tiles: InfoTile[] = profile
    ? [
        { key: "email", label: "Email", value: profile.email, icon: "mail" },
        {
          key: "language",
          label: "Language",
          value: languageLabels[profile.language] ?? profile.language,
          icon: "globe",
        },
        {
          key: "sign-in",
          label: "Signs in with",
          value: profile.intra_login ? `42 account · ${profile.intra_login}` : "Email and password",
          icon: "key",
        },
        {
          key: "roles",
          label: profile.roles.length === 1 ? "Role" : "Roles",
          value: profile.roles.map(formatRole).join(", ") || "Student",
          icon: "shield",
        },
      ]
    : [];

  return (
    <section className="profile-page">
      {isLoading && (
        <div className="profile-hero profile-hero--loading" aria-busy="true">
          <span className="profile-page__sr-only">Loading profile...</span>
        </div>
      )}

      {!isLoading && (loadError || !profile) && (
        <div className="profile-page__message" role="alert">
          Profile information is currently unavailable.
        </div>
      )}

      {!isLoading && profile && (
        <>
          <section className="profile-hero" aria-labelledby="profile-name">
            <div className="profile-hero__body">
              <PersonAvatar
                className="profile-card__avatar"
                name={profile.display_name}
                avatarUrl={profile.avatar_url ?? null}
              />

              <div className="profile-hero__identity">
                <p className="profile-page__eyebrow">Your profile</p>
                <h1 id="profile-name">{profile.display_name}</h1>
                <ul className="profile-hero__roles" aria-label="Roles">
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
                  Edit profile
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
              <h2>Edit your profile</h2>
              <Input
                id="profile-display-name"
                label="Display name"
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
                  Cancel
                </Button>

                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          )}

          <ul className="profile-tiles" aria-label="Account details">
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
                <p className="profile-page__eyebrow">Preferences</p>
                <h2 id="profile-settings-title">Language</h2>
                <p className="profile-settings__hint">
                  Choose the language used across the application.
                </p>
              </div>
            </div>

            <form className="profile-settings__form" onSubmit={handleSettingsSubmit}>
              <fieldset className="profile-languages">
                <legend className="profile-page__sr-only">Language</legend>
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
                      onChange={() => setSettingsLanguage(language)}
                    />
                    <span className="profile-language__code" aria-hidden="true">
                      {language.toUpperCase()}
                    </span>
                    {languageLabels[language]}
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
                  {isSavingSettings ? "Saving..." : "Save settings"}
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
