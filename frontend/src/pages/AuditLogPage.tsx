import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { listAuditLog } from "../api/audit";
import usePageTitle from "../components/layout/usePageTitle";
import { useCurrentUser } from "../store/CurrentUserContext";
import type { AuditAction, AuditEntry, AuditTargetType } from "../types/audit";
import type { Paginated } from "../types/pagination";
import { formatDateTime } from "../utils/dateTime";
import { canViewAuditLog } from "../utils/permissions";
import UnauthorizedPage from "./UnauthorizedPage";
import "../styles/audit-log.css";

type LoadState = "loading" | "ready" | "error";

const PAGE_SIZE = 20;

// The audited actions and target types of api-plan §10.9, in the order the filters list them.
const ACTIONS: AuditAction[] = [
  "role.assigned",
  "role.revoked",
  "user.updated",
  "user.suspended",
  "user.reactivated",
  "user.deleted",
  "eligibility.reviewed",
  "eligibility.revoked",
  "evaluation.released_by_override",
  "evaluation.cancelled_by_override",
  "sc_message.sender_revealed",
  "sc_message.deleted",
];

const TARGET_TYPES: AuditTargetType[] = [
  "user",
  "evaluation_request",
  "tutor_eligibility_request",
  "tutor_eligibility",
  "sc_message",
];

// The page a target opens, for the targets that have one.
const TARGET_LINKS: Partial<Record<AuditTargetType, (id: number) => string>> = {
  // The Admin's own user page (#678), in the same workspace.
  user: (id) => `/manage/users/${id}`,
  evaluation_request: (id) => `/evaluations/${id}`,
  tutor_eligibility_request: (id) => `/eligibility-requests/${id}`,
};

function positiveNumber(value: string | null) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : undefined;
}

// A day from the date filter, as the start or the end of that day in the user's time zone. The
// API needs a datetime with a time zone (§10.9); toISOString gives one in UTC.
function dayBoundary(day: string, end: boolean) {
  const date = new Date(`${day}T${end ? "23:59:59.999" : "00:00:00"}`);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// Admin page of the audit log (#681): who did which sensitive action, when, to what and why,
// newest first (api-plan §10.9). The filters live in the URL (?action=&target_type=&from=&to=,
// and ?actor= or ?target_id= from a click on a name or a target), so a view can be shared.
function AuditLogPage() {
  const { t } = useTranslation();
  usePageTitle(t("auditLog.title"));
  // The real roles from /users/me/; the backend checks them again (§10.9).
  const { roles, isLoaded } = useCurrentUser();
  const allowed = canViewAuditLog(roles);
  const [searchParams, setSearchParams] = useSearchParams();
  const action = ACTIONS.find((item) => item === searchParams.get("action"));
  const targetType = TARGET_TYPES.find((item) => item === searchParams.get("target_type"));
  const targetId = targetType ? positiveNumber(searchParams.get("target_id")) : undefined;
  const actor = positiveNumber(searchParams.get("actor"));
  const fromDay = searchParams.get("from") ?? "";
  const toDay = searchParams.get("to") ?? "";
  const page = positiveNumber(searchParams.get("page")) ?? 1;
  const [result, setResult] = useState<Paginated<AuditEntry> | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let active = true;

    setLoadState("loading");
    listAuditLog({
      action,
      targetType,
      targetId,
      actor,
      from: fromDay ? dayBoundary(fromDay, false) : undefined,
      to: toDay ? dayBoundary(toDay, true) : undefined,
      page,
    })
      .then((answer) => {
        if (active) {
          setResult(answer);
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
  }, [allowed, action, targetType, targetId, actor, fromDay, toDay, page, retryKey]);

  // Changes filters in the URL; any change starts again from the first page.
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

        if (!("page" in changes)) {
          next.delete("page");
        }

        return next;
      },
      { replace: !("page" in changes) },
    );
  }

  function actionLabel(value: string) {
    return t(`auditLog.actions.${value}`, { defaultValue: t("auditLog.unknownAction") });
  }

  function targetLabel(type: string, id: number) {
    return t("auditLog.targetLabel", {
      type: t(`auditLog.targets.${type}`, { defaultValue: t("auditLog.unknownTarget") }),
      id,
    });
  }

  // What the entry changed, from its metadata, in words: never a raw value (AGENTS.md).
  function details(entry: AuditEntry) {
    const { role, decision, new: changed } = entry.metadata;

    if (typeof role === "string") {
      return t("auditLog.roleDetail", { role: t(`roles.${role}`, { defaultValue: role }) });
    }

    if (decision === "approved" || decision === "declined") {
      return t(`auditLog.decision.${decision}`);
    }

    if (changed && typeof changed === "object") {
      const fields = Object.keys(changed).map((field) =>
        t(`auditLog.fields.${field}`, { defaultValue: field }),
      );

      return t("auditLog.changed", { fields: fields.join(", ") });
    }

    return "";
  }

  if (!isLoaded) {
    return (
      <section className="audit-log" aria-busy="true">
        <span className="audit-log__sr-only">{t("auditLog.loading")}</span>
      </section>
    );
  }

  if (!allowed) {
    return <UnauthorizedPage />;
  }

  const entries = result?.results ?? [];
  const total = result?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isFiltered = Boolean(action || targetType || actor || fromDay || toDay);
  // Another page or filter keeps the entries shown, greyed out, until the new ones arrive: the
  // Previous / Next button just used stays in place and keeps the focus (#369).
  const isRefreshing = loadState === "loading" && entries.length > 0;
  const actorName =
    actor !== undefined
      ? (entries.find((entry) => entry.actor?.id === actor)?.actor?.display_name ?? `#${actor}`)
      : "";

  return (
    <section className="audit-log">
      <header className="audit-log__header">
        <h1>{t("auditLog.title")}</h1>
        <p>{t("auditLog.subtitle")}</p>
      </header>

      <div className="audit-log__filters">
        <label className="audit-log__field">
          <span>{t("auditLog.action")}</span>
          <select
            value={action ?? ""}
            onChange={(event) => applyFilters({ action: event.target.value })}
          >
            <option value="">{t("auditLog.allActions")}</option>
            {ACTIONS.map((item) => (
              <option key={item} value={item}>
                {actionLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label className="audit-log__field">
          <span>{t("auditLog.target")}</span>
          <select
            value={targetType ?? ""}
            onChange={(event) => applyFilters({ target_type: event.target.value, target_id: "" })}
          >
            <option value="">{t("auditLog.allTargets")}</option>
            {TARGET_TYPES.map((item) => (
              <option key={item} value={item}>
                {t(`auditLog.targets.${item}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="audit-log__field">
          <span>{t("auditLog.from")}</span>
          <input
            type="date"
            value={fromDay}
            max={toDay || undefined}
            onChange={(event) => applyFilters({ from: event.target.value })}
          />
        </label>

        <label className="audit-log__field">
          <span>{t("auditLog.to")}</span>
          <input
            type="date"
            value={toDay}
            min={fromDay || undefined}
            onChange={(event) => applyFilters({ to: event.target.value })}
          />
        </label>
      </div>

      {(actor !== undefined || targetId !== undefined) && (
        <div className="audit-log__chips">
          {actor !== undefined && (
            <button
              className="audit-log__chip"
              type="button"
              aria-label={t("auditLog.removeActor", { name: actorName })}
              onClick={() => applyFilters({ actor: "" })}
            >
              {t("auditLog.byActor", { name: actorName })} <span aria-hidden="true">×</span>
            </button>
          )}
          {targetType && targetId !== undefined && (
            <button
              className="audit-log__chip"
              type="button"
              aria-label={t("auditLog.removeTarget", {
                target: targetLabel(targetType, targetId),
              })}
              onClick={() => applyFilters({ target_id: "" })}
            >
              {targetLabel(targetType, targetId)} <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      )}

      {loadState === "loading" && !isRefreshing && (
        <div className="audit-log__skeletons" aria-busy="true">
          {[1, 2, 3, 4].map((placeholder) => (
            <div className="audit-log__skeleton" key={placeholder} />
          ))}
          <span className="audit-log__sr-only">{t("auditLog.loading")}</span>
        </div>
      )}

      {loadState === "error" && (
        <div className="audit-log__error" role="alert">
          <p>{t("auditLog.loadError")}</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
            {t("common.tryAgain")}
          </button>
        </div>
      )}

      {loadState === "ready" && entries.length === 0 && (
        <div className="audit-log__empty">
          <h2>{isFiltered ? t("auditLog.emptyFiltered") : t("auditLog.empty")}</h2>
          {isFiltered ? (
            <button
              type="button"
              onClick={() =>
                setSearchParams(new URLSearchParams(), {
                  replace: true,
                })
              }
            >
              {t("auditLog.clearFilters")}
            </button>
          ) : (
            <p>{t("auditLog.emptyText")}</p>
          )}
        </div>
      )}

      {(loadState === "ready" || isRefreshing) && entries.length > 0 && (
        <>
          <p className="audit-log__total">{t("auditLog.total", { count: total })}</p>

          <table
            className="audit-log__table"
            aria-label={t("auditLog.tableAria")}
            aria-busy={isRefreshing}
          >
            <thead>
              <tr>
                <th scope="col">{t("auditLog.when")}</th>
                <th scope="col">{t("auditLog.who")}</th>
                <th scope="col">{t("auditLog.what")}</th>
                <th scope="col">{t("auditLog.target")}</th>
                <th scope="col">{t("auditLog.details")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const target = targetLabel(entry.target_type, entry.target_id);
                const link = TARGET_LINKS[entry.target_type]?.(entry.target_id);
                const detail = details(entry);

                return (
                  <tr key={entry.id}>
                    <td data-label={t("auditLog.when")}>
                      <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
                    </td>
                    <td data-label={t("auditLog.who")}>
                      {entry.actor ? (
                        <button
                          className="audit-log__filter-link"
                          type="button"
                          title={t("auditLog.filterByActor", { name: entry.actor.display_name })}
                          onClick={() => applyFilters({ actor: String(entry.actor?.id ?? "") })}
                        >
                          {entry.actor.display_name}
                        </button>
                      ) : (
                        <span className="audit-log__muted">{t("auditLog.deletedActor")}</span>
                      )}
                    </td>
                    <td data-label={t("auditLog.what")}>
                      <span className="audit-log__action">{actionLabel(entry.action)}</span>
                    </td>
                    <td data-label={t("auditLog.target")}>
                      <button
                        className="audit-log__filter-link"
                        type="button"
                        title={t("auditLog.filterByTarget", { target })}
                        onClick={() =>
                          applyFilters({
                            target_type: entry.target_type,
                            target_id: String(entry.target_id),
                          })
                        }
                      >
                        {target}
                      </button>
                      {link && (
                        <Link
                          className="audit-log__open"
                          to={link}
                          aria-label={t("auditLog.openAria", { target })}
                        >
                          {t("auditLog.open")} <span aria-hidden="true">→</span>
                        </Link>
                      )}
                    </td>
                    <td data-label={t("auditLog.details")}>
                      <div className="audit-log__details">
                        {detail && <span>{detail}</span>}
                        {entry.reason && <q className="audit-log__reason">{entry.reason}</q>}
                        {!detail && !entry.reason && <span className="audit-log__muted">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pageCount > 1 && (
            <nav className="audit-log__pages" aria-label={t("auditLog.pagesAria")}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => applyFilters({ page: page - 1 > 1 ? String(page - 1) : "" })}
              >
                <span aria-hidden="true">‹</span> {t("common.previous")}
              </button>
              <span aria-live="polite">{t("auditLog.page", { page, pages: pageCount })}</span>
              <button
                type="button"
                // `next` is the shown page's until the next one arrives: a second quick click
                // must not ask for a page past the last one.
                disabled={!result?.next || page >= pageCount}
                onClick={() => applyFilters({ page: String(page + 1) })}
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

export default AuditLogPage;
