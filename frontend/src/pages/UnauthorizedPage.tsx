import { Link } from "react-router";

import { useRole } from "../store/RoleContext";
import "../styles/unauthorized.css";

function UnauthorizedPage() {
  const { activeRole } = useRole();

  return (
    <section className="unauthorized-page">
      <div className="unauthorized-page__code">403</div>

      <div className="unauthorized-page__content">
        <p className="unauthorized-page__eyebrow">ACCESS RESTRICTED</p>
        <h1>This page is not available for your current role.</h1>
        <p>
          The <strong>{activeRole}</strong> role does not have permission to view this page.
        </p>

        <Link className="unauthorized-page__action" to="/">
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}

export default UnauthorizedPage;
