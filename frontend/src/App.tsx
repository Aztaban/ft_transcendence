import { Route, Routes } from "react-router";
import RoleGuard from "./components/auth/RoleGuard";
import BaseLayout from "./components/layout/BaseLayout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import { routePermissions } from "./utils/permissions";

function AuthenticatedApp() {
  return (
    <BaseLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/profile"
          element={
            <RoleGuard allowedRoles={routePermissions.profile} fallback={<UnauthorizedPage />}>
              <ProfilePage />
            </RoleGuard>
          }
        />
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
