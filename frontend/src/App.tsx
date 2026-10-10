import { Route, Routes } from "react-router";
import RoleGuard from "./components/auth/RoleGuard";
import BaseLayout from "./components/layout/BaseLayout";
import CreateRequestPage from "./pages/CreateRequestPage";
import HitchhikerRequestsPage from "./pages/HitchhikerRequestsPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProfilePage from "./pages/ProfilePage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import RegisterPage from "./pages/RegisterPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import { useRole } from "./store/RoleContext";
import { routePermissions } from "./utils/permissions";

// /requests by role: a student creates a request, a Hitchhiker sees the open requests to pick.
function RequestsRoute() {
  const { activeRole } = useRole();

  return activeRole === "HITCHHIKER" ? <HitchhikerRequestsPage /> : <CreateRequestPage />;
}

function AuthenticatedApp() {
  return (
    <BaseLayout>
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
        <Route
          path="/profile"
          element={
            <RoleGuard allowedRoles={routePermissions.profile} fallback={<UnauthorizedPage />}>
              <ProfilePage />
            </RoleGuard>
          }
        />
        <Route path="/projects/:slug" element={<ProjectDetailsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
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
