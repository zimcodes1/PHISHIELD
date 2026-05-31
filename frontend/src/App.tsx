import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { UserProvider } from "./context/useAuth";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import ForgotPasswordPage from "./pages/ForgotPassword";
import AnalyzerPage from "./pages/Analyzer";
import HistoryPage from "./pages/History";
import SettingsPage from "./pages/Settings";
import NotFoundPage from "./pages/NotFound";
import DashboardLayout from "./components/dashboard/DashboardLayout";

// UserProvider uses useNavigate, so it must live inside the router.
// This wrapper renders inside the router tree before any page.
function AuthWrapper() {
  return (
    <UserProvider>
      <Outlet />
    </UserProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <AuthWrapper />,
    children: [
      { path: "/login",           element: <LoginPage /> },
      { path: "/signup",          element: <SignupPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      {
        element: <DashboardLayout />,
        children: [
          { path: "/",         element: <AnalyzerPage /> },
          { path: "/history",  element: <HistoryPage /> },
          { path: "/settings", element: <SettingsPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
