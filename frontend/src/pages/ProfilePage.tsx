import { useEffect, useState, type FormEvent } from "react";

import { getCurrentUser, updateCurrentUser } from "../api/users";
import avatar from "../assets/figma/avatar.png";
import { Badge, Button, Input } from "../components/ui";
import type { Language, UserProfile, UserRole } from "../types/user";
import "../styles/profile.css";

const languageLabels: Record<Language, string> = {
  en: "English",
  cs: "Czech",
  cz: "Czech",
  es: "Spanish",
};

function getRoleName(role: UserRole | string) {
  return typeof role === "string" ? role : role.name;
}

function formatRole(role: UserRole | string) {
  const name = getRoleName(role);

  const labels: Record<string, string> = {
    student: "STUDENT",
    tutor: "HITCHHIKER",
    head_tutor: "HEAD TUTOR",
    sc_member: "STUDENT COUNCIL",
    admin: "ADMIN",
  };

  return labels[name] ?? name.split("_").join(" ").toUpperCase();
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

    if (trimmedDisplayName.length > 64) {
      setFormError("Display name must be 64 characters or fewer.");
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
    } catch {
      setFormError("Unable to save profile changes.");
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
    } catch {
      setSettingsError("Unable to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  return (
    <main className="profile-page">
      <header className="profile-page__header">
        <div>
          <p className="profile-page__eyebrow">42 EVALS ACCOUNT</p>
          <h1>Profile</h1>
        </div>

        {profile && !isEditing && (
          <Button variant="secondary" onClick={startEditing}>
            EDIT PROFILE
          </Button>
        )}
      </header>

      {isLoading && (
        <section className="profile-card">
          <div className="profile-card__details">
            <div className="profile-detail">
              <span className="profile-detail__label">PROFILE</span>
              <span className="profile-detail__value">Loading profile...</span>
            </div>
          </div>
        </section>
      )}

      {!isLoading && (loadError || !profile) && (
        <section className="profile-card">
          <div className="profile-card__details">
            <div className="profile-detail">
              <span className="profile-detail__label">PROFILE</span>
              <span className="profile-detail__value profile-detail__value--muted">
                Profile information is currently unavailable.
              </span>
            </div>
          </div>
        </section>
      )}

      {!isLoading && profile && (
        <>
          <section className="profile-card">
            <div className="profile-card__identity">
              <img className="profile-card__avatar" src={avatar} alt="Profile avatar" />

              <div className="profile-card__identity-copy">
                <p className="profile-card__label">DISPLAY NAME</p>
                <h2>{profile.display_name}</h2>

                <div className="profile-card__roles">
                  {profile.roles.map((role, index) => (
                    <Badge key={`${getRoleName(role)}-${index}`} variant="accent">
                      {formatRole(role)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {isEditing ? (
              <form className="profile-edit-form" onSubmit={handleProfileSubmit}>
                <Input
                  id="profile-display-name"
                  label="Display name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={64}
                  autoComplete="username"
                />

                {formError && (
                  <p className="profile-edit-form__error" role="alert">
                    {formError}
                  </p>
                )}

                <div className="profile-edit-form__actions">
                  <Button type="button" variant="ghost" onClick={cancelEditing} disabled={isSaving}>
                    CANCEL
                  </Button>

                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "SAVING..." : "SAVE CHANGES"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="profile-card__details">
                <div className="profile-detail">
                  <span className="profile-detail__label">EMAIL</span>
                  <span className="profile-detail__value">{profile.email}</span>
                </div>

                <div className="profile-detail">
                  <span className="profile-detail__label">LANGUAGE</span>
                  <span className="profile-detail__value">
                    {languageLabels[profile.language] ?? profile.language}
                  </span>
                </div>

                <div className="profile-detail">
                  <span className="profile-detail__label">ROLES</span>
                  <span className="profile-detail__value">
                    {profile.roles.length > 0
                      ? profile.roles.map(formatRole).join(", ")
                      : "Student"}
                  </span>
                </div>
              </div>
            )}

            {saveMessage && (
              <p className="profile-card__success" role="status">
                {saveMessage}
              </p>
            )}
          </section>

          <section className="profile-settings">
            <div className="profile-settings__header">
              <div>
                <p className="profile-card__label">PREFERENCES</p>
                <h2>Profile settings</h2>
              </div>
            </div>

            <form className="profile-settings__form" onSubmit={handleSettingsSubmit}>
              <div className="profile-edit-form__field">
                <label htmlFor="profile-language">Language</label>

                <select
                  id="profile-language"
                  value={settingsLanguage}
                  onChange={(event) => setSettingsLanguage(event.target.value as Language)}
                >
                  <option value="en">English</option>
                  <option value="cs">Czech</option>
                  <option value="es">Spanish</option>
                </select>

                <p className="profile-settings__hint">
                  Choose the language used across the application.
                </p>
              </div>

              {settingsError && (
                <p className="profile-edit-form__error" role="alert">
                  {settingsError}
                </p>
              )}

              {settingsMessage && (
                <p className="profile-settings__success" role="status">
                  {settingsMessage}
                </p>
              )}

              <div className="profile-edit-form__actions">
                <Button type="submit" disabled={isSavingSettings}>
                  {isSavingSettings ? "SAVING..." : "SAVE SETTINGS"}
                </Button>
              </div>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

export default ProfilePage;
