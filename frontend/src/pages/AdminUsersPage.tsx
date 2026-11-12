import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { listAdminUsers } from "../api/admin";
import usePageTitle from "../components/layout/usePageTitle";
import UserStatusBadge, { rolesText } from "../features/admin/UserStatusBadge";
import type { AdminUser, UserStatus } from "../types/adminUser";
import type { RoleName } from "../types/user";
import { formatDate } from "../utils/dateTime";
import "../styles/admin-users.css";

type LoadState = "loading" | "ready" | "error";

// api-plan §5.7: default page size.
const PAGE_SIZE = 20;

// The filter values of GET /admin/users/ (api-plan §10.2), in the order the selects show them.
const roleFilters: readonly RoleName[] = ["student", "tutor", "head_tutor", "sc_member", "admin"];
const statusFilters: readonly UserStatus[] = ["active", "suspended", "deleted"];

// Administration "Users" (#678): every account from GET /admin/users/ (api-plan §10.2), searched
// by email, display name or 42 login and filtered by role and status, in pages of 20.
function AdminUsersPage() {
  const { t } = useTranslation();

  usePageTitle(t("adminUsers.title"));
  // What is typed in the box, and the search sent once the form is submitted.
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  // "" means no filter: the parameter is then left out of the request.
  const [role, setRole] = useState<RoleName | "">("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    // An answer that arrives after the filters changed again is dropped.
    let active = true;

    setLoadState("loading");

    listAdminUsers({
      q: query || undefined,
      role: role || undefined,
      status: status || undefined,
      page,
    })
      .then((result) => {
        if (active) {
          setUsers(result.results);
          setTotal(result.count);
          setHasNext(result.next !== null);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active) {
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [query, role, status, page]);

  // A search starts on submit (button or Enter), not on every key, so no timer can send an old one.
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(text.trim());
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isFiltered = query !== "" || role !== "" || status !== "";
  // Another page or filter keeps the rows shown, greyed out, until the new ones arrive: the
  // Previous / Next button just used stays in place and keeps the focus (#369).
  const isRefreshing = loadState === "loading" && users.length > 0;

  return (
    <section className="admin-users">
      <header className="admin-users__header">
        <h1 id="admin-users-title">{t("adminUsers.title")}</h1>
        <p>{t("adminUsers.subtitle")}</p>
      </header>

      <div className="admin-users__filters">
        <form className="admin-users__search" role="search" onSubmit={search}>
          <label htmlFor="admin-users-search">{t("adminUsers.search")}</label>
          <div className="admin-users__search-row">
            <input
              id="admin-users-search"
              type="search"
              value={text}
              placeholder={t("adminUsers.searchPlaceholder")}
              onChange={(event) => setText(event.target.value)}
            />
            <button type="submit">{t("adminUsers.searchButton")}</button>
          </div>
        </form>

        <label className="admin-users__select">
          <span>{t("adminUsers.role")}</span>
          <select
            value={role}
            onChange={(event) => {
              // Only a listed value becomes the filter; anything else means "all".
              setRole(roleFilters.find((value) => value === event.target.value) ?? "");
              setPage(1);
            }}
          >
            <option value="">{t("adminUsers.allRoles")}</option>
            {roleFilters.map((value) => (
              <option key={value} value={value}>
                {t(`roles.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-users__select">
          <span>{t("adminUsers.status")}</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(statusFilters.find((value) => value === event.target.value) ?? "");
              setPage(1);
            }}
          >
            <option value="">{t("adminUsers.allStatuses")}</option>
            {statusFilters.map((value) => (
              <option key={value} value={value}>
                {t(`adminUsers.statuses.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadState === "loading" && !isRefreshing && (
        <div className="admin-users__list" aria-busy="true">
          {[1, 2, 3].map((placeholder) => (
            <div className="admin-users__skeleton" key={placeholder} />
          ))}
          <span className="admin-users__sr-only">{t("adminUsers.loading")}</span>
        </div>
      )}

      {loadState === "error" && (
        <p className="admin-users__error" role="alert">
          {t("adminUsers.error")}
        </p>
      )}

      {loadState === "ready" && users.length === 0 && (
        <div className="admin-users__empty">
          <h2>{isFiltered ? t("adminUsers.emptyFilteredTitle") : t("adminUsers.emptyTitle")}</h2>
        </div>
      )}

      {(loadState === "ready" || isRefreshing) && users.length > 0 && (
        <>
          <div className="admin-users__table-wrap" aria-busy={isRefreshing}>
            <table className="admin-users__table" aria-labelledby="admin-users-title">
              <thead>
                <tr>
                  <th scope="col">{t("adminUsers.columns.name")}</th>
                  <th scope="col">{t("adminUsers.columns.email")}</th>
                  <th scope="col">{t("adminUsers.columns.roles")}</th>
                  <th scope="col">{t("adminUsers.columns.status")}</th>
                  <th scope="col">{t("adminUsers.columns.lastLogin")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td data-label={t("adminUsers.columns.name")}>
                      <Link to={`/manage/users/${user.id}`}>{user.display_name}</Link>
                    </td>
                    <td data-label={t("adminUsers.columns.email")}>{user.email}</td>
                    <td data-label={t("adminUsers.columns.roles")}>{rolesText(user)}</td>
                    <td data-label={t("adminUsers.columns.status")}>
                      <UserStatusBadge status={user.status} />
                    </td>
                    <td data-label={t("adminUsers.columns.lastLogin")}>
                      {user.last_login ? (
                        <time dateTime={user.last_login}>{formatDate(user.last_login)}</time>
                      ) : (
                        t("adminUsers.never")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <nav className="admin-users__pages" aria-label={t("adminUsers.pagesAria")}>
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <span aria-hidden="true">‹</span> {t("common.previous")}
              </button>
              <span aria-live="polite">{t("adminUsers.page", { page, count: pageCount })}</span>
              <button
                type="button"
                // `hasNext` is the shown page's until the next one arrives: a second quick click
                // must not ask for a page past the last one.
                disabled={!hasNext || page >= pageCount}
                onClick={() => setPage((current) => current + 1)}
              >
                {t("common.next")} <span aria-hidden="true">›</span>
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export default AdminUsersPage;
