import { useEffect, useState } from "react";

import { getCurrentUser } from "../api/users";
import avatar from "../assets/figma/avatar.png";
import { Badge } from "../components/ui";
import type { Language, UserProfile, UserRole } from "../types/user";
import "../styles/profile.css";

const languageLabels: Record<Language, string> = {
  en: "English",
  cs: "Czech",
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
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((data) => {
        if (active) {
          setProfile(data);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
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

  return (
    <main className="profile-page">
      <header className="profile-page__header">
        <p className="profile-page__eyebrow">42 EVALS ACCOUNT</p>
        <h1>Profile</h1>
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

      {!isLoading && (error || !profile) && (
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
                {profile.roles.length > 0 ? profile.roles.map(formatRole).join(", ") : "Student"}
              </span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export default ProfilePage;
