import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { EvaluationRequest } from "../../types/evaluation";
import { formatSlot } from "../../utils/dateTime";

interface OpenRequestsProps {
  requests: EvaluationRequest[];
  // True during the first load: a skeleton instead of the empty state (#258).
  isLoading?: boolean;
}

function needsConfirmation(request: EvaluationRequest) {
  return request.status === "awaiting_confirmation";
}

function OpenRequests({ requests, isLoading = false }: OpenRequestsProps) {
  const { t } = useTranslation();
  // Requests waiting for the student's answer are listed first.
  const openRequests = requests
    .filter((request) => request.status === "pending" || needsConfirmation(request))
    .sort((a, b) => Number(needsConfirmation(b)) - Number(needsConfirmation(a)));

  return (
    <section
      className="dashboard__section dashboard__section--teal"
      aria-labelledby="open-requests-title"
    >
      <h2 id="open-requests-title">{t("dashboard.openRequests")}</h2>

      {isLoading ? (
        <div className="dashboard-requests" aria-busy="true">
          <div className="dashboard-requests__skeleton" />
          <div className="dashboard-requests__skeleton" />
          <span className="dashboard-requests__sr-only">{t("myRequests.loading")}</span>
        </div>
      ) : openRequests.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty__history-mark" aria-hidden="true">
            —
          </div>
          <h3>{t("hitchhikerRequests.emptyTitle")}</h3>
          <p>{t("dashboard.studentOpenEmpty")}</p>
        </div>
      ) : (
        <div className="dashboard-requests">
          {openRequests.map((request) => (
            <article
              className={
                needsConfirmation(request)
                  ? "dashboard-request dashboard-request--needs-confirmation"
                  : "dashboard-request"
              }
              key={request.id}
            >
              <div>
                <h3>{request.project.name}</h3>

                {needsConfirmation(request) && request.starts_at && request.ends_at ? (
                  <p>
                    <Trans
                      i18nKey="dashboard.proposed"
                      values={{
                        name: request.picked_by?.display_name ?? "",
                        slot: formatSlot(request.starts_at, request.ends_at),
                      }}
                      components={{ time: <time dateTime={request.starts_at} /> }}
                    />
                  </p>
                ) : (
                  <p>{t("dashboard.evaluationRequest")}</p>
                )}
              </div>

              <span className="dashboard-request__status">
                {needsConfirmation(request)
                  ? t("status.needsConfirmation")
                  : t("dashboard.pending")}
              </span>

              {/* The student answers on /evaluations/{id}, the page the notification opens (§8.8). */}
              {needsConfirmation(request) && (
                <div className="dashboard-request__actions">
                  <Link
                    className="dashboard-request__review"
                    to={`/evaluations/${request.id}`}
                    aria-label={t("dashboard.reviewProposalAria", {
                      project: request.project.name,
                    })}
                  >
                    {t("dashboard.reviewProposal")} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default OpenRequests;
