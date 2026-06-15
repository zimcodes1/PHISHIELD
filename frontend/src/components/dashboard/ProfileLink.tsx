import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

export default function ProfileLink() {
  const { user } = useAuth();
  const initial = user?.fullname?.trim().charAt(0).toUpperCase() ?? "?";

  return (
    <Link
      to="/settings"
      className="inline-flex max-sm:absolute right-0 top-0 items-center gap-3 max-sm:gap-0 rounded-xl border glass-card px-2 py-2 shadow-sm hover:border-brand-300 hover:bg-brand-50/50 transition min-w-0"
      aria-label="Open settings"
    >
      <div className="w-9 h-9 rounded-xl bg-linear-to-br from-brand-400 to-brand-600 flex items-center justify-center shrink-0 shadow-sm shadow-brand-200">
        <span className="text-sm font-bold text-white">{initial}</span>
      </div>
      <span className="text-sm font-semibold text-ink truncate max-w-36 max-sm:hidden">
        {user?.fullname ?? "Account"}
      </span>
    </Link>
  );
}
