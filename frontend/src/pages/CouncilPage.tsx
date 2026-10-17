import { Link } from "react-router";

import councilIcon from "../assets/figma/student-council.svg";
import "../styles/council.css";

// What happens to a message (api-plan §7.3): the council reads it, never who sent it, and
// cannot answer the sender.
const howItWorks = [
  { title: "Write your message", text: "An idea, a problem or feedback for the council." },
  { title: "The council reads it", text: "Council members see the message, never who sent it." },
  { title: "They act on it", text: "They cannot reply to you directly: you stay anonymous." },
];

// Sidebar "Student Council" (Figma "Studen council"): how to reach the council anonymously.
// TODO: the members grid from the Figma frame, once the people search API with
// `role=sc_member` (api-plan §10.8, #44) is on main.
function CouncilPage() {
  return (
    <section className="council-page">
      <header className="council-header">
        <h1>Student Council</h1>
        <p>Share an idea, a problem or feedback with the people who represent you.</p>
      </header>

      <div className="council-layout">
        <article className="council-invite">
          <span className="council-invite__icon" aria-hidden="true">
            <img src={councilIcon} alt="" />
          </span>
          <div className="council-invite__content">
            <h2>Talk to the council</h2>
            <p>
              Need help, have a suggestion, or want to share your thoughts? Send us an anonymous
              message. Your feedback helps us improve the platform and better support the 42 Prague
              community.
            </p>
            <div className="council-actions">
              <Link className="council-button" to="/council/send">
                Send a message <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </article>

        <aside className="council-aside">
          <section className="council-panel">
            <h2>How it works</h2>
            <ol className="council-steps">
              {howItWorks.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="council-panel council-panel--tip">
            <h2>Tip</h2>
            <p>Be specific: say what happened, where and when, so the council can act on it.</p>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default CouncilPage;
