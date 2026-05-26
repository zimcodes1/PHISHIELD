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
        ${collapsed ? "w-16" : "w-56"} max-sm:w-9/10 max-sm:h-15
        max-sm:flex-row max-sm:fixed max-sm:bottom-2 max-sm:top-auto
        max-sm:rounded-3xl max-sm:ml-[5%] max-sm:z-50
      `}
		>
			{/* Logo + toggle */}
			<div
				className={`flex items-center h-16 px-4 border-b border-white/10 ${collapsed ? "justify-center" : "justify-between"} max-sm:hidden`}
			>
				{!collapsed && (
					<div className="flex items-center gap-2">
						<LogoIcon className="w-7 h-7 text-brand-400 shrink-0" />
						<span className="text-white font-bold text-base tracking-tight">
							PhishShield
						</span>
					</div>
				)}
				<button
					onClick={() => setCollapsed(!collapsed)}
					className="text-white/50 hover:text-white transition p-1 rounded-lg hover:bg-white/10 cursor-pointer"
				>
					<i
						className={`bx ${collapsed ? "bx-chevron-right" : "bx-chevron-left"} text-xl`}
					/>
				</button>
			</div>

			{/* Nav links */}
			<nav className="flex-1 max-sm:flex-none flex flex-col max-sm:flex-row gap-1 px-2 py-4 max-sm:p-2 overflow-hidden">
				{navItems.map(({ to, icon, label }) => (
					<NavLink
						key={to}
						to={to}
						end={to === "/"}
						className={({ isActive }) =>
							`flex items-center gap-3 px-3 py-2.5 rounded-xl max-sm:rounded-2xl transition-all duration-300 group
      ${
				isActive
					? "bg-brand-500 text-white shadow-md shadow-brand-700/40"
					: "text-white/60 hover:text-white hover:bg-white/10"
			}
      ${collapsed ? "justify-center" : ""}`
						}
					>
						{({ isActive }) => (
							<>
								<i className={`bx ${icon} text-xl shrink-0`} />

								{!collapsed && (
									<div
										className={`grid transition-all duration-300 ease-in-out
              ${
								isActive
									? "grid-rows-[1fr] opacity-100 max-sm:w-20"
									: "grid-rows-[0fr] opacity-0 max-sm:w-0"
							}
              max-sm:overflow-hidden max-sm:inline-grid sm:block`}
									>
										<span className="hidden max-sm:block text-sm font-medium overflow-hidden whitespace-nowrap">
											{label}
										</span>
									</div>
								)}
								{!collapsed && (
                  <span className="max-sm:hidden text-sm font-medium overflow-hidden whitespace-nowrap">
									{label}
								</span>
                )}
							</>
						)}
					</NavLink>
				))}
			</nav>

			{/* Logout */}
			<div className="px-2 pb-4 max-sm:p-0 max-sm:flex max-sm:ml-auto border-t border-white/10 pt-4">
				<button
					onClick={handleLogout}
					className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl max-sm:rounded-2xl text-white/60 hover:text-danger hover:bg-danger/10 transition-all duration-150 cursor-pointer ${collapsed ? "justify-center" : ""}`}
				>
					<i className="bx bx-log-out text-xl shrink-0" />
					{!collapsed && (
						<span className="max-sm:hidden text-sm font-medium">Logout</span>
					)}
				</button>
			</div>
		</aside>
	);
}
