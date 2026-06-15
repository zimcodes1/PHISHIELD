import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function DashboardLayout() {
  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <Sidebar />
      <main
        className="flex-1 overflow-y-auto"
        style={{
          backgroundColor: "#ecececaf",
          backgroundImage:
            "linear-gradient(to right, #cbd5e16c 1px, transparent 1px), linear-gradient(to bottom, #cbd5e16c 1px, transparent 1px)",
          backgroundSize: "100px 100px",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
