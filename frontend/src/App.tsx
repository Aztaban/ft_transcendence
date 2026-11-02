import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";

import RoleGuard from "./components/auth/RoleGuard";
import BaseLayout from "./components/layout/BaseLayout";
import HitchhikerOnboarding from "./features/hitchhiker/HitchhikerOnboarding";
import CouncilInboxMessagePage from "./pages/CouncilInboxMessagePage";
import CouncilInboxPage from "./pages/CouncilInboxPage";
import CouncilMessagePage from "./pages/CouncilMessagePage";
import CouncilPage from "./pages/CouncilPage";
import CreateRequestPage from "./pages/CreateRequestPage";
import EligibilityRequestPage from "./pages/EligibilityRequestPage";
import EligibilityReviewPage from "./pages/EligibilityReviewPage";
import EvaluationPage from "./pages/EvaluationPage";
import HistoryPage from "./pages/HistoryPage";
import HitchhikerRequestsPage from "./pages/HitchhikerRequestsPage";
import HitchhikersPage from "./pages/HitchhikersPage";
import HomePage from "./pages/HomePage";
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

// Every page except login and registration needs a session (#328). Nothing is rendered, and so
// no API is called, until the session check has answered; logged out, the user goes to the login
// page, which brings them back here afterwards.
function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
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
        <Route path="/evaluations/:id" element={<EvaluationPage />} />
        <Route
          path="/requests/:id"
          element={
            <RoleGuard allowedRoles={["HITCHHIKER"]} fallback={<UnauthorizedPage />}>
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
            <RoleGuard
              allowedRoles={routePermissions.eligibilityRequest}
              fallback={<UnauthorizedPage />}
            >
              <EligibilityRequestPage />
            </RoleGuard>
          }
        />
        <Route
          path="/eligibility-requests"
          element={
            <RoleGuard
              allowedRoles={routePermissions.eligibilityReview}
              fallback={<UnauthorizedPage />}
            >
              <EligibilityReviewPage />
            </RoleGuard>
          }
        />
        <Route
          path="/profile"
          element={
            <RoleGuard allowedRoles={routePermissions.profile} fallback={<UnauthorizedPage />}>
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
              <CouncilInboxMessagePage />
            </RoleGuard>
          }
        />
        <Route path="/projects/:slug" element={<ProjectDetailsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <HitchhikerOnboarding />
    </BaseLayout>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<AuthenticatedApp />} />
    </Routes>
  );
}

export default App;
