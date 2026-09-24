import avatar from "../assets/figma/avatar.png";
import { Badge } from "../components/ui";
import "../styles/profile.css";

function ProfilePage() {
  return (
    <main className="profile-page">
      <header className="profile-page__header">
        <p className="profile-page__eyebrow">42 EVALS ACCOUNT</p>
        <h1>Profile</h1>
      </header>

      <section className="profile-card">
        <div className="profile-card__identity">
          <img className="profile-card__avatar" src={avatar} alt="Profile avatar" />

          <div className="profile-card__identity-copy">
            <p className="profile-card__label">DISPLAY NAME</p>
            <h2>Display name</h2>

            <div className="profile-card__roles">
              <Badge variant="accent">STUDENT</Badge>
            </div>
          </div>
        </div>

        <div className="profile-card__details">
          <div className="profile-detail">
            <span className="profile-detail__label">EMAIL</span>
            <span className="profile-detail__value">student@example.com</span>
          </div>

          <div className="profile-detail">
            <span className="profile-detail__label">42 ACCOUNT</span>
            <span className="profile-detail__value profile-detail__value--muted">
              Not connected
            </span>
          </div>

          <div className="profile-detail">
            <span className="profile-detail__label">LANGUAGE</span>
            <span className="profile-detail__value">English</span>
          </div>

          <div className="profile-detail">
            <span className="profile-detail__label">ACCOUNT STATUS</span>
            <span className="profile-detail__value">
              <Badge variant="success">ACTIVE</Badge>
            </span>
          </div>

          <div className="profile-detail">
            <span className="profile-detail__label">ROLES</span>
            <span className="profile-detail__value">Student</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export default ProfilePage;
