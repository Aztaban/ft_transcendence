import { Navigate } from "react-router";
import { useAuth } from "../store/AuthContext";


export default function GuestOnly({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
  
    if (isLoading) return null;              // session check still running
    if (isAuthenticated) return <Navigate to="/" replace />;
    return <>{children}</>;
  }