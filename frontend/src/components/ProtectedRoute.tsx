import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import Preloader from "./Preloader";

export default function ProtectedRoute() {
  const { access_token, auth_loading } = useAuth();
  const location = useLocation();

  if (auth_loading) {
    return <Preloader message="Checking session..." />;
  }

  if (!access_token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
