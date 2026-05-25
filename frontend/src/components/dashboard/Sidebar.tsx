import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogoIcon } from "../CustomIcons";

const navItems = [
  { to: "/", icon: "bx-home-alt-2", label: "Home" },
  { to: "/history", icon: "bx-history", label: "History" },
  { to: "/settings", icon: "bx-cog", label: "Settings" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <aside
      className={`
        flex flex-col h-screen bg-ink sticky top-0
        transition-all duration-300 ease-in-out shrink-0
        ${collapsed ? "w-16" : "w-56"}
      `}
    >
      {/* Logo + toggle */}
      <div className={`flex items-center h-16 px-4 border-b border-white/10 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <LogoIcon className="w-7 h-7 text-brand-400 shrink-0" />
            <span className="text-white font-bold text-base tracking-tight">PhishShield</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-white/50 hover:text-white transition p-1 rounded-lg hover:bg-white/10 cursor-pointer"
        >
          <i className={`bx ${collapsed ? "bx-chevron-right" : "bx-chevron-left"} text-xl`} />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 flex flex-col gap-1 px-2 py-4 overflow-hidden">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
              ${isActive
                ? "bg-brand-500 text-white shadow-md shadow-brand-700/40"
                : "text-white/60 hover:text-white hover:bg-white/10"
              }
              ${collapsed ? "justify-center" : ""}`
            }
          >
            <i className={`bx ${icon} text-xl shrink-0`} />
            {!collapsed && <span className="text-sm font-medium">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-white/10 pt-4">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-danger hover:bg-danger/10 transition-all duration-150 cursor-pointer ${collapsed ? "justify-center" : ""}`}
        >
          <i className="bx bx-log-out text-xl shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
