import { createBrowserRouter, RouterProvider } from "react-router-dom";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import AnalyzerPage from "./pages/Analyzer";
import HistoryPage from "./pages/History";
import SettingsPage from "./pages/Settings";
import DashboardLayout from "./components/dashboard/DashboardLayout";

const router = createBrowserRouter([
  { path: "/login",  element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  {
    element: <DashboardLayout />,
    children: [
      { path: "/",         element: <AnalyzerPage /> },
      { path: "/history",  element: <HistoryPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
