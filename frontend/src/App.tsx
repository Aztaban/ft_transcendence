import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from "react-router";

import RoleGuard from "./components/auth/RoleGuard";
import BaseLayout from "./components/layout/BaseLayout";
import { LEGAL_PAGES, legalDocumentAt } from "./components/layout/legalPages";
import PublicLayout from "./components/layout/PublicLayout";
import HitchhikerOnboarding from "./features/hitchhiker/HitchhikerOnboarding";
import AdminUserDetailPage from "./pages/AdminUserDetailPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AuditLogPage from "./pages/AuditLogPage";
import CouncilHistoryPage from "./pages/CouncilHistoryPage";
import { CouncilMessageRoute } from "./pages/CouncilInboxMessagePage";
import CouncilInboxPage from "./pages/CouncilInboxPage";
import CouncilMessagePage from "./pages/CouncilMessagePage";
import CouncilPage from "./pages/CouncilPage";
import CreateRequestPage from "./pages/CreateRequestPage";
import DesignSystemPage from "./pages/DesignSystemPage";
import { EligibilityRequestRoute } from "./pages/EligibilityRequestDetailPage";
import EligibilityRequestPage from "./pages/EligibilityRequestPage";
import EligibilityReviewPage from "./pages/EligibilityReviewPage";
import EvaluationExceptionsPage from "./pages/EvaluationExceptionsPage";
import EvaluationPage from "./pages/EvaluationPage";
import HistoryPage from "./pages/HistoryPage";
import HitchhikerRequestsPage from "./pages/HitchhikerRequestsPage";
import HitchhikersPage from "./pages/HitchhikersPage";
import HomePage from "./pages/HomePage";
import LegalPage from "./pages/LegalPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PendingPage from "./pages/PendingPage";
import PersonProfilePage from "./pages/PersonProfilePage";
import PickSlotPage from "./pages/PickSlotPage";
import ProfilePage from "./pages/ProfilePage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import RegisterPage from "./pages/RegisterPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import { useAuth } from "./store/AuthContext";
import { useRole } from "./store/RoleContext";
import { takeReturnPath } from "./utils/loginReturn";
import { routePermissions } from "./utils/permissions";

// /requests by role: a student creates a request, a Hitchhiker sees the open requests to pick.
function RequestsRoute() {
  const { activeRole } = useRole();

  return activeRole === "HITCHHIKER" ? <HitchhikerRequestsPage /> : <CreateRequestPage />;
}

// Each user gets a new page instance, so a form being edited never carries over to another user
// opened from the list or with Back.
function AdminUserRoute() {
  const { id } = useParams();

  return <AdminUserDetailPage key={id} />;
}

// The same for each evaluation (#369): another one opened from a notification shows its loading
// state, never the previous evaluation, its messages or its error in the meantime.
function EvaluationRoute() {
  const { id } = useParams();

  return <EvaluationPage key={id} />;
}

// Back from the 42 login, which always lands on "/" (api-plan §10.1): opens the page the user
// wanted before logging in, kept by the Login page (#328).
function ReturnAfterLogin() {
  const navigate = useNavigate();

  useEffect(() => {
    const path = takeReturnPath();

    if (path) {
      navigate(path, { replace: true });
    }
  }, [navigate]);

  return null;
}

// Every page except login, registration and the legal pages needs a session (#328). Nothing is
// rendered, and so no API is called, until the session check has answered; logged out, the user
// goes to the login page, which brings them back here afterwards.
function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  // The legal pages need no session: logged in they stay inside the application shell.
  const legalPage = legalDocumentAt(location.pathname);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return legalPage ? (
      <PublicLayout>
        <LegalPage kind={legalPage} standalone />
      </PublicLayout>
    ) : (
      <Navigate to="/login" replace state={{ from: location }} />
    );
  }

  return (
    <BaseLayout>
      <ReturnAfterLogin />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/requests"
          element={
            <RoleGuard allowedRoles={routePermissions.requests} fallback={<UnauthorizedPage />}>
              <RequestsRoute />
            </RoleGuard>
          }
        />
        <Route path="/evaluations/:id" element={<EvaluationRoute />} />
        <Route
          path="/requests/:id"
          element={
            // The evaluation page links here for a Hitchhiker in any workspace (#690).
            <RoleGuard
              allowedRoles={["HITCHHIKER"]}
              fallback={<UnauthorizedPage />}
              switchWorkspace
            >
              <PickSlotPage />
            </RoleGuard>
          }
        />
        <Route
          path="/pending"
          element={
            <RoleGuard allowedRoles={routePermissions.pending} fallback={<UnauthorizedPage />}>
              <PendingPage />
            </RoleGuard>
          }
        />
        <Route
          path="/history"
          element={
            <RoleGuard allowedRoles={routePermissions.history} fallback={<UnauthorizedPage />}>
              <HistoryPage />
            </RoleGuard>
          }
        />
        <Route
          path="/eligibility-requests/new"
          element={
            // The eligibility request page links here from any workspace (#685).
            <RoleGuard
              allowedRoles={routePermissions.eligibilityRequest}
              fallback={<UnauthorizedPage />}
              switchWorkspace
            >
              <EligibilityRequestPage />
            </RoleGuard>
          }
        />
        {/* The eligibility notifications link here (§8.8) for the requester, Head Tutors and
            Admins, in whichever workspace they are: the API decides who may see it (§10.3). */}
        <Route path="/eligibility-requests/:id" element={<EligibilityRequestRoute />} />
        <Route
          path="/eligibility-requests"
          element={
            // The eligibility request page links back here from any workspace (#685).
            <RoleGuard
              allowedRoles={routePermissions.eligibilityReview}
              fallback={<UnauthorizedPage />}
              switchWorkspace
            >
              <EligibilityReviewPage />
            </RoleGuard>
          }
        />
        <Route
          path="/profile"
          element={
            // `eligibility.revoked`, `role.changed` and `account.updated` link here from any
            // workspace (§8.8), the Student Council one too (#687).
            <RoleGuard
              allowedRoles={routePermissions.profile}
              fallback={<UnauthorizedPage />}
              switchWorkspace
            >
              <ProfilePage />
            </RoleGuard>
          }
        />
        <Route path="/hitchhikers" element={<HitchhikersPage />} />
        <Route path="/people/:id" element={<PersonProfilePage />} />
        <Route
          path="/council"
          element={
            <RoleGuard allowedRoles={routePermissions.council} fallback={<UnauthorizedPage />}>
              <CouncilPage />
            </RoleGuard>
          }
        />
        <Route
          path="/council/send"
          element={
            <RoleGuard allowedRoles={routePermissions.council} fallback={<UnauthorizedPage />}>
              <CouncilMessagePage />
            </RoleGuard>
          }
        />
        <Route
          path="/council/inbox"
          element={
            <RoleGuard
              allowedRoles={routePermissions.councilMessages}
              fallback={<UnauthorizedPage />}
            >
              <CouncilInboxPage />
            </RoleGuard>
          }
        />
        <Route
          path="/council/inbox/:id"
          element={
            // The `sc_message.created` notification links here from any workspace (§8.8).
            <RoleGuard
              allowedRoles={routePermissions.councilMessages}
              fallback={<UnauthorizedPage />}
              switchWorkspace
            >
              <CouncilMessageRoute />
            </RoleGuard>
          }
        />
        <Route
          path="/council/history"
          element={
            <RoleGuard
              allowedRoles={routePermissions.councilHistory}
              fallback={<UnauthorizedPage />}
            >
              <CouncilHistoryPage />
            </RoleGuard>
          }
        />
        {/* Admin pages use /manage/: Nginx sends /admin/ to the Django admin. */}
        <Route
          path="/manage/users"
          element={
            <RoleGuard allowedRoles={routePermissions.adminUsers} fallback={<UnauthorizedPage />}>
              <AdminUsersPage />
            </RoleGuard>
          }
        />
        <Route
          path="/manage/users/:id"
          element={
            <RoleGuard allowedRoles={routePermissions.adminUsers} fallback={<UnauthorizedPage />}>
              <AdminUserRoute />
            </RoleGuard>
          }
        />
        <Route
          path="/manage/exceptions"
          element={
            <RoleGuard
              allowedRoles={routePermissions.evaluationExceptions}
              fallback={<UnauthorizedPage />}
            >
              <EvaluationExceptionsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/manage/audit-log"
          element={
            <RoleGuard allowedRoles={routePermissions.auditLog} fallback={<UnauthorizedPage />}>
              <AuditLogPage />
            </RoleGuard>
          }
        />
        <Route path="/projects/:slug" element={<ProjectDetailsPage />} />
        {/* The design system (#730), linked from the footer: open to every workspace. */}
        <Route path="/design-system" element={<DesignSystemPage />} />
        {LEGAL_PAGES.map((page) => (
          <Route key={page.path} path={page.path} element={<LegalPage kind={page.kind} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <HitchhikerOnboarding />
    </BaseLayout>
  );
}

// Every new page opens at its top, logged in or not: a link at the bottom of a page (the footer,
// a card on Home) would otherwise open the next page scrolled down, with its title out of view.
// Only the path counts, so a filter in the query string keeps the place.
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.documentElement.scrollTop = 0;
  }, [pathname]);

  return null;
}

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route
          element={
            <PublicLayout legalLinksInNewTab>
              <Outlet />
            </PublicLayout>
          }
        >
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route path="*" element={<AuthenticatedApp />} />
      </Routes>
    </>
  );
}

export default App;
