import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EyeIcon, EyeOffIcon } from "../components/CustomIcons";
import { LockIcon } from "../components/CustomIcons";

// TODO: replace with real auth context / API data
const MOCK_USER = {
  fullName: "Azimeh Okafor",
  email: "azimeh@example.com",
};

const MOCK_STATS = {
  total: 47,
  safe: 28,
  suspicious: 11,
  phishing: 8,
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [pwStatus, setPwStatus] = useState<"idle" | "success" | "error">("idle");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const initial = MOCK_USER.fullName.trim().charAt(0).toUpperCase();

  const setField = (field: keyof typeof passwordForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }));

  const toggleShow = (field: keyof typeof show) =>
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.next !== passwordForm.confirm) { setPwStatus("error"); return; }
    // TODO: call PATCH /auth/password
    setPwStatus("success");
    setPasswordForm({ current: "", next: "", confirm: "" });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition text-sm";

  const statCards = [
    { label: "Total Scans",      value: MOCK_STATS.total,      icon: "bx-scan",         color: "text-brand-500", bg: "bg-brand-50" },
    { label: "Clean",            value: MOCK_STATS.safe,       icon: "bx-check-shield", color: "text-safe",      bg: "bg-safe/10" },
    { label: "Suspicious",       value: MOCK_STATS.suspicious, icon: "bx-error",        color: "text-caution",   bg: "bg-caution/10" },
    { label: "Phishing Blocked", value: MOCK_STATS.phishing,   icon: "bx-shield-x",     color: "text-danger",    bg: "bg-danger/10" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
        <p className="text-ink-muted text-sm mt-1">Manage your account and preferences.</p>
      </div>

      {/* ── Profile card ── */}
      <section className="bg-canvas border border-outline rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">Profile</h2>

        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shrink-0 shadow-md shadow-brand-200">
            <span className="text-2xl font-bold text-white">{initial}</span>
          </div>

          <div className="space-y-1 min-w-0">
            <p className="text-base font-semibold text-ink truncate">{MOCK_USER.fullName}</p>
            <p className="text-sm text-ink-muted flex items-center gap-1.5 truncate">
              <i className="bx bx-envelope text-brand-400" />
              {MOCK_USER.email}
            </p>
          </div>
        </div>
      </section>

      {/* ── Scan stats ── */}
      <section className="bg-canvas border border-outline rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">Scan Activity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(({ label, value, icon, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl px-4 py-4 flex flex-col gap-2`}>
              <i className={`bx ${icon} text-2xl ${color}`} />
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-ink-muted leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Reset password ── */}
      <section className="bg-canvas border border-outline rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">Reset Password</h2>

        <form onSubmit={handleResetPassword} className="space-y-3">
          {(["current", "next", "confirm"] as const).map((field) => {
            const labels = { current: "Current password", next: "New password", confirm: "Confirm new password" };
            return (
              <div key={field} className="relative">
                <input
                  type={show[field] ? "text" : "password"}
                  required
                  value={passwordForm[field]}
                  onChange={setField(field)}
                  placeholder={labels[field]}
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => toggleShow(field)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  {show[field] ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            );
          })}

          {pwStatus === "error" && (
            <p className="text-sm text-danger flex items-center gap-1.5">
              <i className="bx bx-x-circle" /> New passwords do not match.
            </p>
          )}
          {pwStatus === "success" && (
            <p className="text-sm text-safe flex items-center gap-1.5">
              <i className="bx bx-check-circle" /> Password updated successfully.
            </p>
          )}

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
          >
            <span className="flex gap-1 justify-between items-center"><LockIcon></LockIcon>Update password</span>
          </button>
        </form>
      </section>

      {/* ── Logout ── */}
      <section className="max-sm:mb-10 bg-canvas border border-outline rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">Session</h2>
        <p className="text-sm text-ink-muted">Signing out will clear your session. You'll need to log in again to access your dashboard.</p>

        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-danger/40 text-danger hover:bg-danger/5 text-sm font-medium transition cursor-pointer"
          >
            <i className="bx bx-log-out text-lg" /> Sign out
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-ink">Are you sure?</p>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-danger hover:bg-red-600 text-white text-sm font-semibold transition cursor-pointer"
            >
              Yes, sign out
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="px-4 py-2 rounded-xl border border-outline text-ink-muted hover:text-ink text-sm transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

    </div>
  );
}
