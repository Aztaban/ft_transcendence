import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";

import hitchhikersIcon from "../assets/figma/hitchhikers.svg";
import profileIcon from "../assets/figma/profile.svg";
import councilIcon from "../assets/figma/student-council.svg";
import { ApiError } from "../api/client";
import { getTutorEligibility } from "../api/eligibility";
import { listEvaluationRequests } from "../api/evaluationRequests";
import { listProjects } from "../api/projects";
import { getPublicUser } from "../api/users";
import PersonAvatar from "../features/people/PersonAvatar";
import { isHitchhiker, roleBadges } from "../features/people/roleBadges";
import i18n, { dateLocale } from "../i18n";
import { useAuth } from "../store/AuthContext";
import { useCurrentUser } from "../store/CurrentUserContext";
import { useRole } from "../store/RoleContext";
import type { EvaluationRequest } from "../types/evaluation";
import type { PublicUser } from "../types/people";
import type { ProjectRef } from "../types/project";
import type { UserRole } from "../types/user";
import { formatSlot } from "../utils/dateTime";
import "../styles/person-profile.css";

type LoadState = "loading" | "ready" | "not-found" | "error" | "logged-out";
type Tone = "green" | "red" | "teal" | "amber" | "violet" | "grey";

// The title is the role's label (`roles.<role>`), the text a key of the "person" texts.
interface RoleCard {
  role: UserRole["name"];
  text: string;
  icon: string;
}

// What each role does (§5.8, §7.2, §7.3). A Head Tutor gets the Head Tutor card instead of the
// Hitchhiker one, like the role pills.
const roleCards: RoleCard[] = [
  {
    role: "head_tutor",
    text: "headTutorText",
    icon: profileIcon,
  },
  {
    role: "tutor",
    text: "tutorText",
    icon: hitchhikersIcon,
  },
  {
    role: "sc_member",
    text: "councilText",
    icon: councilIcon,
  },
];

function cardsFor(person: PublicUser) {
  const names = person.roles.map((role) => role.name);

  return roleCards.filter(
    (card) => names.includes(card.role) && !(card.role === "tutor" && names.includes("head_tutor")),
  );
}

// The outcome shown on "Your evaluations with …", like the History cards.
function outcome(request: EvaluationRequest, now: Date): { label: string; tone: Tone } {
  if (request.status === "cancelled") {
    return { label: i18n.t("status.cancelled"), tone: "grey" };
  }

  if (request.status === "expired") {
    return { label: i18n.t("status.expired"), tone: "grey" };
  }

  if (request.status === "awaiting_confirmation") {
    return { label: i18n.t("status.needsAnswer"), tone: "amber" };
  }

  if (request.status === "pending") {
    return { label: i18n.t("status.inQueue"), tone: "grey" };
  }

  if (request.result === "passed") {
    return { label: i18n.t("status.passed"), tone: "green" };
  }

  if (request.result === "failed") {
    return { label: i18n.t("status.failed"), tone: "red" };
  }

  if (request.starts_at && new Date(request.starts_at).getTime() > now.getTime()) {
    return { label: i18n.t("person.upcoming"), tone: "teal" };
  }

  return { label: i18n.t("status.resultPending"), tone: "violet" };
}

function dateParts(iso: string) {
  const date = new Date(iso);

  return {
    day: date.getDate(),
    month: date.toLocaleDateString(dateLocale(), { month: "short" }),
  };
}

// /people/{id} (#10, Figma "Bio_student_council", styled like the 42 intra profile): a
// Hitchhiker's or Student Council member's public profile, opened from the Hitchhikers search.
// Only what GET /users/{id}/ returns (`PublicUser`, §8.3: never the email or the 42 login); for
// Hitchhikers the projects from GET /tutors/{id}/eligibility/ out of GET /projects/ (§10.3); and
// for a student, their own requests this Hitchhiker picked (GET /evaluation-requests/, §10.4).
// Users have no bio (R10).
function PersonProfilePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const personId = Number(id);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isSessionLoading } = useAuth();
  const { user } = useCurrentUser();
  const { activeRole } = useRole();
  const [person, setPerson] = useState<PublicUser | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  // `null` while loading. The rest of the profile is shown even if these fail.
  const [eligible, setEligible] = useState<ProjectRef[] | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectRef[] | null>(null);
  const [projectsFailed, setProjectsFailed] = useState(false);
  const [together, setTogether] = useState<EvaluationRequest[] | null>(null);
  const [togetherFailed, setTogetherFailed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const isMe = person !== null && user?.id === person.id;
  const hitchhiker = person !== null && isHitchhiker(person.roles);
  // A student sees their own evaluations with this Hitchhiker.
  const showsTogether = hitchhiker && !isMe && activeRole === "STUDENT";

  useEffect(() => {
    // The endpoints need a session: wait for the session check (no 401 in the console).
    if (isSessionLoading || !isAuthenticated) {
      return;
    }

    if (!Number.isInteger(personId) || personId <= 0) {
      setLoadState("not-found");
      return;
    }

    let active = true;

    setLoadState("loading");
    getPublicUser(personId)
      .then((result) => {
        if (active) {
          setPerson(result);
          setLoadState("ready");
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          // The session expired after the check (§5.6 `not_authenticated`).
          setLoadState("logged-out");
        } else {
          setLoadState(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
        }
      });

    return () => {
      active = false;
    };
  }, [personId, isSessionLoading, isAuthenticated, retryKey]);

  // The projects they can evaluate, out of all active projects.
  useEffect(() => {
    if (!person || !hitchhiker) {
      return;
    }

    let active = true;

    setEligible(null);
    setAllProjects(null);
    setProjectsFailed(false);

    getTutorEligibility(person.id)
      .then((list) => {
        if (active) {
          setEligible(list);
        }
      })
      .catch(() => {
        if (active) {
          setProjectsFailed(true);
        }
      });

    listProjects()
      .then((list) => {
        if (active) {
          setAllProjects(list);
        }
      })
      .catch(() => {
        // Without the full list, the strip shows only the projects they can evaluate.
      });

    return () => {
      active = false;
    };
  }, [person, hitchhiker]);

  // The student's own requests this Hitchhiker picked: the active ones and the latest history
  // page. There is no filter on `picked_by`, so the pages are filtered here.
  useEffect(() => {
    if (!person || !showsTogether) {
      return;
    }

    let active = true;

    setTogether(null);
    setTogetherFailed(false);

    Promise.all([
      listEvaluationRequests({ scope: "mine" }),
      listEvaluationRequests({ scope: "mine", history: true }),
    ])
      .then(([current, past]) => {
        if (active) {
          setTogether(
            [...current.results, ...past.results].filter(
              (request) => request.picked_by?.id === person.id,
            ),
          );
        }
      })
      .catch(() => {
        if (active) {
          setTogetherFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [person, showsTogether]);

  useEffect(() => {
    if (!isCopied) {
      return;
    }

    const timeout = window.setTimeout(() => setIsCopied(false), 2000);

    return () => window.clearTimeout(timeout);
  }, [isCopied]);

  if (!isSessionLoading && (!isAuthenticated || loadState === "logged-out")) {
    return <Navigate to="/login" replace />;
  }

  // Opened from another page of the app: go back there (the Hitchhikers search keeps its filters).
  const canGoBack = location.key !== "default";
  const canCopy = typeof navigator !== "undefined" && Boolean(navigator.clipboard);
  const eligibleSlugs = new Set((eligible ?? []).map((project) => project.slug));
  const strip = allProjects ?? eligible ?? [];
  const percent =
    eligible && allProjects && allProjects.length > 0
      ? Math.round((eligible.length / allProjects.length) * 100)
      : null;
  const badges = person ? roleBadges(person.roles) : [];
  const cards = person ? cardsFor(person) : [];
  const now = new Date();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
    } catch {
      // Clipboard access refused: nothing to do, the address bar still has the link.
    }
  }

  return (
    <section className="person-profile">
      {canGoBack ? (
        <button className="person-profile__back" type="button" onClick={() => navigate(-1)}>
          <span aria-hidden="true">‹</span> {t("person.back")}
        </button>
      ) : (
        <Link className="person-profile__back" to="/hitchhikers">
          <span aria-hidden="true">‹</span> {t("nav.hitchhikers")}
        </Link>
      )}

      {loadState === "loading" && (
        <div className="person-profile__skeleton" aria-busy="true">
          <span className="person-profile__sr-only">{t("person.loading")}</span>
        </div>
      )}

      {loadState === "not-found" && (
        <div className="person-profile__message" role="alert">
          <h1>{t("person.notFoundTitle")}</h1>
          <p>{t("person.notFoundText")}</p>
          <Link to="/hitchhikers">{t("person.findHitchhiker")}</Link>
        </div>
      )}

      {loadState === "error" && (
        <div className="person-profile__message person-profile__message--error" role="alert">
          <p>{t("person.error")}</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
            {t("common.tryAgain")}
          </button>
        </div>
      )}

      {loadState === "ready" && person && (
        <>
          <header className="person-profile__banner">
            <div className="person-profile__identity">
              <PersonAvatar
                className="person-profile__avatar"
                name={person.display_name}
                avatarUrl={person.avatar_url}
              />

              <div className="person-profile__who">
                <h1>{person.display_name}</h1>
                <p className="person-profile__campus">
                  <span aria-hidden="true">📍</span> 42 Prague
                </p>
                <ul className="person-profile__roles" aria-label={t("hitchhikers.rolesAria")}>
                  {(badges.length > 0 ? badges : ["student"]).map((badge) => (
                    <li key={badge}>{t(`roles.${badge}`)}</li>
                  ))}
                </ul>
              </div>
            </div>

            {hitchhiker && percent !== null && eligible && allProjects && (
              <div className="person-profile__level">
                <div className="person-profile__level-text">
                  <span>{t("hitchhikers.canEvaluate")}</span>
                  <strong>
                    {t("person.ofProjects", {
                      eligible: eligible.length,
                      total: allProjects.length,
                    })}
                  </strong>
                </div>
                <div
                  className="person-profile__level-bar"
                  role="progressbar"
                  aria-label={t("person.levelAria")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span style={{ width: `${percent}%` }} />
                </div>
                <span className="person-profile__level-percent">{percent}%</span>
              </div>
            )}

            <nav className="person-profile__actions" aria-label={t("person.actionsAria")}>
              {showsTogether && (
                <Link
                  className="person-profile__action person-profile__action--primary"
                  to="/requests"
                >
                  {t("hitchhikers.createRequest")} <span aria-hidden="true">→</span>
                </Link>
              )}
              {isMe && (
                <Link className="person-profile__action" to="/profile">
                  {t("person.editProfile")}
                </Link>
              )}
              <Link className="person-profile__action" to="/hitchhikers">
                {t("person.findMore")}
              </Link>
              {canCopy && (
                <button className="person-profile__action" type="button" onClick={copyLink}>
                  {isCopied ? t("person.copied") : t("person.copyLink")}
                </button>
              )}
            </nav>
          </header>

          {isMe && <p className="person-profile__me">{t("person.me")}</p>}

          {hitchhiker && (
            <section className="person-profile__strip" aria-labelledby="person-profile-projects">
              <div className="person-profile__strip-head">
                <h2 id="person-profile-projects">{t("person.projects")}</h2>
                <span className="person-profile__legend">
                  <span aria-hidden="true">✓</span> {t("person.legend")}
                </span>
              </div>

              {eligible === null && !projectsFailed && (
                <div className="person-profile__strip-skeleton" aria-busy="true">
                  <span className="person-profile__sr-only">{t("person.loadingProjects")}</span>
                </div>
              )}

              {projectsFailed && (
                <p className="person-profile__strip-note">{t("person.projectsError")}</p>
              )}

              {eligible?.length === 0 && (
                <p className="person-profile__strip-note">{t("hitchhikers.noProjects")}</p>
              )}

              {eligible && eligible.length > 0 && (
                <ul className="person-profile__segments">
                  {strip.map((project, index) => {
                    const on = eligibleSlugs.has(project.slug);

                    return (
                      <li key={project.id} style={{ "--index": index } as CSSProperties}>
                        <Link
                          className={
                            on
                              ? "person-profile__segment person-profile__segment--on"
                              : "person-profile__segment"
                          }
                          to={`/projects/${project.slug}`}
                          aria-label={t(on ? "person.segmentCan" : "person.segmentCannot", {
                            project: project.name,
                          })}
                        >
                          <span aria-hidden="true">{on ? "✓" : "–"}</span>
                          {project.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <div className="person-profile__grid">
            {cards.length > 0 && (
              <section className="person-profile__panel" aria-labelledby="person-profile-roles">
                <div className="person-profile__panel-head">
                  <h2 id="person-profile-roles">{t("person.roles")}</h2>
                </div>
                <ul className="person-profile__cards">
                  {cards.map((card, index) => (
                    <li
                      className="person-profile__card"
                      key={card.role}
                      style={{ "--index": index } as CSSProperties}
                    >
                      <span className="person-profile__card-icon">
                        <img src={card.icon} alt="" aria-hidden="true" />
                      </span>
                      <div>
                        <h3>{t(`roles.${card.role}`)}</h3>
                        <p>{t(`person.${card.text}`)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {showsTogether && (
              <section className="person-profile__panel" aria-labelledby="person-profile-together">
                <div className="person-profile__panel-head">
                  <h2 id="person-profile-together">
                    {t("person.together", { name: person.display_name })}
                  </h2>
                  <Link className="person-profile__panel-link" to="/history">
                    {t("person.yourHistory")}
                  </Link>
                </div>

                {together === null && !togetherFailed && (
                  <div className="person-profile__rows-skeleton" aria-busy="true">
                    <span className="person-profile__sr-only">{t("person.loadingTogether")}</span>
                  </div>
                )}

                {togetherFailed && (
                  <p className="person-profile__note">{t("person.togetherError")}</p>
                )}

                {together?.length === 0 && (
                  <p className="person-profile__note">
                    {t("person.togetherEmpty", { name: person.display_name })}
                  </p>
                )}

                {together && together.length > 0 && (
                  <ul className="person-profile__rows">
                    {together.map((request, index) => {
                      const result = outcome(request, now);
                      const parts = dateParts(request.starts_at ?? request.created_at);

                      return (
                        <li key={request.id} style={{ "--index": index } as CSSProperties}>
                          <Link
                            className={`person-profile__row person-profile__row--${result.tone}`}
                            to={`/evaluations/${request.id}`}
                          >
                            <span className="person-profile__date" aria-hidden="true">
                              <strong>{parts.day}</strong>
                              {parts.month}
                            </span>
                            <span className="person-profile__row-main">
                              <strong>{request.project.name}</strong>
                              <span>
                                {request.starts_at && request.ends_at
                                  ? formatSlot(request.starts_at, request.ends_at)
                                  : t("person.noSlot")}
                              </span>
                            </span>
                            <span className="person-profile__outcome">{result.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default PersonProfilePage;
