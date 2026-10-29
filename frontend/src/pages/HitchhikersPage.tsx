import { useEffect, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router";

import hitchhikersIcon from "../assets/figma/hitchhikers.svg";
import profileIcon from "../assets/figma/profile.svg";
import requestIcon from "../assets/figma/request.svg";
import searchIcon from "../assets/figma/search.svg";
import { ApiError } from "../api/client";
import { countPeople, searchPeople, type PeopleOrdering } from "../api/people";
import { listProjects } from "../api/projects";
import PersonAvatar from "../features/people/PersonAvatar";
import { roleBadges } from "../features/people/roleBadges";
import { useRole } from "../store/RoleContext";
import type { PersonResult } from "../types/people";
import type { ProjectRef } from "../types/project";
import "../styles/hitchhikers.css";

type LoadState = "loading" | "ready" | "error";

interface Overview {
  hitchhikers: number;
  headTutors: number;
}

// api-plan §10.8: `q` is 2–64 characters.
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 64;
// Waits for a pause in typing, so a search is not sent for every letter (60 a minute, §5.9).
const SEARCH_DELAY_MS = 300;

const orderings: { value: PeopleOrdering; label: string }[] = [
  { value: "display_name", label: "Name A–Z" },
  { value: "-display_name", label: "Name Z–A" },
];

function searchErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === "throttled") {
    return "Too many searches in a short time. Wait a moment and try again.";
  }

  if (error instanceof ApiError && error.code === "validation_error") {
    return error.fields?.q?.[0] ?? error.message;
  }

  return "Could not load the Hitchhikers. Please try again.";
}

// Sidebar "Hitchhikers" (#45, Figma "Hitchhikers"): find a Hitchhiker for an evaluation with
// GET /search/people/?role=tutor (§10.8), by name and project, sorted by name, 20 at a time.
// The filters live in the URL (?q=&project=&ordering=).
function HitchhikersPage() {
  const { activeRole } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const project = searchParams.get("project") ?? "";
  const ordering: PeopleOrdering =
    searchParams.get("ordering") === "-display_name" ? "-display_name" : "display_name";
  const searchTerm = query.length >= MIN_QUERY_LENGTH ? query : undefined;

  const [text, setText] = useState(query);
  // `null` until loaded (or when the list could not be loaded).
  const [projects, setProjects] = useState<ProjectRef[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  // A new search while results are shown keeps them, dimmed, until the answer arrives.
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // "Show more" failed: the next click loads the same page again.
  const [moreFailed, setMoreFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    listProjects()
      .then((result) => {
        if (active) {
          setProjects(result);
        }
      })
      .catch(() => {
        // The project filter is optional; the search still works without it.
      });

    // The overview counts everyone, whatever the filters. It is optional too.
    Promise.all([countPeople("tutor"), countPeople("head_tutor")])
      .then(([hitchhikers, headTutors]) => {
        if (active) {
          setOverview({ hitchhikers, headTutors });
        }
      })
      .catch(() => {
        // The tiles show "—".
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (page === 1) {
      setLoadState((current) => (current === "ready" ? current : "loading"));
      setIsSearching(true);
    }

    searchPeople({
      role: "tutor",
      q: searchTerm,
      project: project || undefined,
      ordering,
      page,
    })
      .then((result) => {
        if (active) {
          setPeople((current) => (page === 1 ? result.results : [...current, ...result.results]));
          setTotal(result.count);
          setHasMore(result.next !== null);
          setLoadState("ready");
        }
      })
      .catch((error) => {
        if (active) {
          if (page === 1) {
            setErrorMessage(searchErrorMessage(error));
            setLoadState("error");
          } else {
            setMoreFailed(true);
          }
        }
      })
      .finally(() => {
        if (active) {
          setIsSearching(false);
          setIsLoadingMore(false);
        }
      });

    return () => {
      active = false;
    };
  }, [searchTerm, project, ordering, page, retryKey]);

  // Changes the filters in the URL and starts again from the first page.
  function applyFilters(changes: Record<string, string>) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        for (const [key, value] of Object.entries(changes)) {
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
        }

        return next;
      },
      { replace: true },
    );
    setPage(1);
    setMoreFailed(false);
  }

  // Puts the typed name in the URL after a short pause. Re-run when any filter changes, so the
  // timer never writes back an older URL.
  useEffect(() => {
    const value = text.trim();

    if (value === query) {
      return;
    }

    const timeout = window.setTimeout(() => applyFilters({ q: value }), SEARCH_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [text, query, project, ordering]);

  function clearFilters() {
    setText("");
    applyFilters({ q: "", project: "" });
  }

  function retry() {
    setRetryKey((key) => key + 1);
  }

  function showMore() {
    setIsLoadingMore(true);

    if (moreFailed) {
      setMoreFailed(false);
      setRetryKey((key) => key + 1);
    } else {
      setPage((current) => current + 1);
    }
  }

  const isFiltered = searchTerm !== undefined || project !== "";
  const projectName = projects?.find((item) => item.slug === project)?.name ?? project;
  const tiles = [
    { label: "Hitchhikers", value: overview?.hitchhikers, icon: hitchhikersIcon },
    { label: "Head Tutors", value: overview?.headTutors, icon: profileIcon },
    { label: "Projects to evaluate", value: projects?.length, icon: requestIcon },
  ];
  const isTooShort = text.trim().length > 0 && text.trim().length < MIN_QUERY_LENGTH;

  return (
    <section className="hitchhikers">
      <header className="hitchhikers__header">
        <h1>Hitchhikers</h1>
        <p>Find a Hitchhiker for your next evaluation, old and new core.</p>
      </header>

      <ul className="hitchhikers__overview" aria-label="Overview">
        {tiles.map((tile, index) => (
          <li
            className="hitchhikers__tile"
            key={tile.label}
            style={{ "--index": index } as CSSProperties}
          >
            <span className="hitchhikers__tile-icon">
              <img src={tile.icon} alt="" aria-hidden="true" />
            </span>
            <strong>{tile.value ?? "—"}</strong>
            <span>{tile.label}</span>
          </li>
        ))}
      </ul>

      <aside className="hitchhikers__how" aria-label="How it works">
        <span className="hitchhikers__how-icon" aria-hidden="true">
          i
        </span>
        <div>
          <strong>How it works</strong>
          <p>
            You can&apos;t book a specific Hitchhiker. Create a request, and any Hitchhiker who can
            evaluate the project can pick it and propose a time.
          </p>
        </div>
        {activeRole === "STUDENT" && (
          <Link className="hitchhikers__how-link" to="/requests">
            Create a request <span aria-hidden="true">→</span>
          </Link>
        )}
      </aside>

      <div className="hitchhikers__filters">
        <label className="hitchhikers__search">
          <img src={searchIcon} alt="" aria-hidden="true" />
          <input
            type="search"
            value={text}
            maxLength={MAX_QUERY_LENGTH}
            placeholder="Search by name"
            aria-label="Search Hitchhikers by name"
            aria-describedby="hitchhikers-search-hint"
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <label className="hitchhikers__select">
          <span>Project</span>
          <select
            value={project}
            onChange={(event) => applyFilters({ project: event.target.value })}
          >
            <option value="">All projects</option>
            {(projects ?? []).map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="hitchhikers__select">
          <span>Sort</span>
          <select
            value={ordering}
            onChange={(event) =>
              applyFilters({
                ordering: event.target.value === "-display_name" ? "-display_name" : "",
              })
            }
          >
            {orderings.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="hitchhikers__summary">
        <p className="hitchhikers__status" id="hitchhikers-search-hint" aria-live="polite">
          {isTooShort && `Type at least ${MIN_QUERY_LENGTH} characters to search by name.`}
          {!isTooShort && isSearching && loadState === "ready" && "Searching…"}
          {!isTooShort &&
            !isSearching &&
            loadState === "ready" &&
            total > 0 &&
            `${total} ${total === 1 ? "Hitchhiker" : "Hitchhikers"}`}
        </p>

        {searchTerm && (
          <button
            className="hitchhikers__chip"
            type="button"
            aria-label={`Remove the name filter "${searchTerm}"`}
            onClick={() => {
              setText("");
              applyFilters({ q: "" });
            }}
          >
            “{searchTerm}” <span aria-hidden="true">×</span>
          </button>
        )}

        {project && (
          <button
            className="hitchhikers__chip"
            type="button"
            aria-label={`Remove the project filter ${projectName}`}
            onClick={() => applyFilters({ project: "" })}
          >
            {projectName} <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      {loadState === "loading" && (
        <div className="hitchhikers__list" aria-busy="true">
          {[1, 2, 3].map((placeholder) => (
            <div className="hitchhikers__skeleton" key={placeholder} />
          ))}
          <span className="hitchhikers__sr-only">Loading Hitchhikers…</span>
        </div>
      )}

      {loadState === "error" && (
        <div className="hitchhikers__error" role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && people.length === 0 && (
        <div className="hitchhikers__empty">
          <h2>{isFiltered ? "No Hitchhikers found" : "No Hitchhikers yet"}</h2>
          <p>
            {isFiltered
              ? "Try another name or project."
              : "Hitchhikers appear here once a Head Tutor approves them."}
          </p>
          {isFiltered && (
            <button type="button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {loadState === "ready" && people.length > 0 && (
        <ul
          className={
            isSearching ? "hitchhikers__list hitchhikers__list--searching" : "hitchhikers__list"
          }
          aria-busy={isSearching}
        >
          {people.map((person, index) => (
            <li
              className="hitchhiker-card"
              key={person.id}
              style={{ "--index": index % 20 } as CSSProperties}
            >
              <div className="hitchhiker-card__person">
                <PersonAvatar
                  className="hitchhiker-card__avatar"
                  name={person.display_name}
                  avatarUrl={person.avatar_url}
                />
                <h2>
                  {/* Covers the whole card (::after), so the card opens the profile (#10). */}
                  <Link className="hitchhiker-card__link" to={`/people/${person.id}`}>
                    {person.display_name}
                  </Link>
                </h2>
                <ul className="hitchhiker-card__badges" aria-label="Roles">
                  {roleBadges(person.roles).map((badge) => (
                    <li key={badge}>{badge}</li>
                  ))}
                </ul>
              </div>

              <span className="hitchhiker-card__more" aria-hidden="true">
                View profile →
              </span>

              <div className="hitchhiker-card__projects">
                <div className="hitchhiker-card__projects-head">
                  <h3>Can evaluate</h3>
                  {person.eligible_projects.length > 0 && (
                    <span className="hitchhiker-card__count">
                      {person.eligible_projects.length}{" "}
                      {person.eligible_projects.length === 1 ? "project" : "projects"}
                    </span>
                  )}
                </div>
                {person.eligible_projects.length > 0 ? (
                  <ul>
                    {person.eligible_projects.map((item) => (
                      <li
                        key={item.id}
                        className={
                          item.slug === project ? "hitchhiker-card__project--match" : undefined
                        }
                      >
                        <span aria-hidden="true">✓</span>
                        {item.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No projects yet.</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {loadState === "ready" && moreFailed && (
        <p className="hitchhikers__more-error" role="alert">
          Could not load more Hitchhikers. Please try again.
        </p>
      )}

      {loadState === "ready" && (hasMore || moreFailed) && (
        <button
          className="hitchhikers__more"
          type="button"
          disabled={isLoadingMore}
          onClick={showMore}
        >
          {isLoadingMore ? "Loading…" : `Show more (${total - people.length} left)`}
        </button>
      )}
    </section>
  );
}

export default HitchhikersPage;
