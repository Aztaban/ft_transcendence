import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import councilIcon from "../assets/figma/student-council.svg";
import "../styles/council.css";

// What happens to a message (api-plan §7.3): the council reads it, never who sent it, and
// cannot answer the sender.
// The texts are "council.how<Step>Title" and "council.how<Step>Text".
const howItWorks = ["Write", "Read", "Act"];

// Sidebar "Student Council" (Figma "Studen council"): how to reach the council anonymously.
// TODO: the members grid from the Figma frame, once the people search API with
// `role=sc_member` (api-plan §10.8, #44) is on main.
function CouncilPage() {
  const { t } = useTranslation();

  return (
    <section className="council-page">
      <header className="council-header">
        <h1>{t("council.title")}</h1>
        <p>{t("council.subtitle")}</p>
      </header>

      <div className="council-layout">
        <article className="council-invite">
          <span className="council-invite__icon" aria-hidden="true">
            <img src={councilIcon} alt="" />
          </span>
          <div className="council-invite__content">
            <h2>{t("council.inviteTitle")}</h2>
            <p>{t("council.inviteText")}</p>
            <div className="council-actions">
              <Link className="council-button" to="/council/send">
                {t("council.send")} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </article>

        <aside className="council-aside">
          <section className="council-panel">
            <h2>{t("council.howItWorks")}</h2>
            <ol className="council-steps">
              {howItWorks.map((item) => (
                <li key={item}>
                  <strong>{t(`council.how${item}Title`)}</strong>
                  <span>{t(`council.how${item}Text`)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="council-panel council-panel--tip">
            <h2>{t("council.tip")}</h2>
            <p>{t("council.tipText")}</p>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default CouncilPage;
