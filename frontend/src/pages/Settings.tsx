import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { getUserStats, updatePassword } from "../api/authService";
import type { UserStats } from "../api/types";
import { EyeIcon, EyeOffIcon, LockIcon } from "../components/CustomIcons";
import { Alert } from "../components/Toast";
import axios from "axios";

export default function SettingsPage() {
  const { user, logout, access_token } = useAuth();

  // ── Password form ─────────────────────────────────────────────────────────
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [pwStatus, setPwStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pwError, setPwError] = useState<string | null>(null);

  // ── Scan stats ────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<UserStats | null>(null);

  // ── Logout confirm ────────────────────────────────────────────────────────
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    document.title = "PhishShield | Settings";
    if (access_token) {
      getUserStats(access_token)
        .then(setStats)
        .catch(() => {}); // stats are non-critical, fail silently
    }
  }, [access_token]);

  const initial = user?.fullname?.trim().charAt(0).toUpperCase() ?? "?";

  const setField = (field: keyof typeof passwordForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPwError(null);
      setPwStatus("idle");
      setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const toggleShow = (field: keyof typeof show) =>
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.next !== passwordForm.confirm) {
      setPwError("New passwords do not match.");
      return;
    }
    if (passwordForm.next.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    setPwStatus("loading");
    setPwError(null);
    try {
      await updatePassword(passwordForm.current, passwordForm.next, access_token!);
      setPwStatus("success");
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setPwError(typeof detail === "string" ? detail : "Failed to update password. Please try again.");
      setPwStatus("error");
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition text-sm";

  const statCards = [
    { label: "Total Scans",      value: stats?.total,      icon: "bx-scan",         color: "text-brand-500", bg: "bg-brand-50"    },
    { label: "Clean",            value: stats?.safe,       icon: "bx-shield-check", color: "text-safe",      bg: "bg-safe/10"     },
    { label: "Suspicious",       value: stats?.suspicious, icon: "bx-error",        color: "text-caution",   bg: "bg-caution/10"  },
    { label: "Phishing Blocked", value: stats?.phishing,   icon: "bx-shield-x",     color: "text-danger",    bg: "bg-danger/10"   },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
        <p className="text-ink-muted text-sm mt-1">Manage your account and preferences.</p>
      </div>

      {/* ── Profile ── */}
      <section className="bg-canvas border border-outline rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">Profile</h2>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-brand-400 to-brand-600 flex items-center justify-center shrink-0 shadow-md shadow-brand-200">
            <span className="text-2xl font-bold text-white">{initial}</span>
          </div>
          <div className="space-y-1 min-w-0">
            <p className="text-base font-semibold text-ink truncate">{user?.fullname ?? "—"}</p>
            <p className="text-sm text-ink-muted flex items-center gap-1.5 truncate">
              <i className="bx bx-envelope text-brand-400" />
              {user?.email ?? "—"}
            </p>
            <p className="text-xs text-ink-muted flex items-center gap-1.5">
              <i className="bx bx-calendar text-brand-300" />
              Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "—"}
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
              <p className={`text-2xl font-bold ${color}`}>
                {value ?? <span className="text-ink-muted text-base">—</span>}
              </p>
              <p className="text-xs text-ink-muted leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Update password ── */}
      <section className="bg-canvas border border-outline rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">Update Password</h2>
        <form onSubmit={handleUpdatePassword} className="space-y-3" noValidate>
          {(["current", "next", "confirm"] as const).map((field) => {
            const labels = { current: "Current password", next: "New password", confirm: "Confirm new password" };
            return (
              <div key={field} className="relative">
                <input
                  type={show[field] ? "text" : "password"}
                  required
                  autoComplete={field === "current" ? "current-password" : "new-password"}
                  value={passwordForm[field]}
                  onChange={setField(field)}
                  placeholder={labels[field]}
                  className={`${inputClass} pr-12`}
                />
                <button type="button" onClick={() => toggleShow(field)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer">
                  {show[field] ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            );
          })}

          {pwError && <Alert variant="error" message={pwError} onDismiss={() => setPwError(null)} />}
          {pwStatus === "success" && <Alert variant="success" message="Password updated successfully." />}

          <button
            type="submit"
            disabled={pwStatus === "loading"}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {pwStatus === "loading" ? (
              <><i className="bx bx-loader-alt animate-spin text-base" /> Updating…</>
            ) : (
              <><LockIcon /> Update password</>
            )}
          </button>
        </form>
      </section>

      {/* ── Session / Logout ── */}
      <section className="max-sm:mb-10 bg-canvas border border-outline rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">Session</h2>
        <p className="text-sm text-ink-muted">
          Signing out will clear your session. You'll need to log in again to access your dashboard.
        </p>
        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-danger/40 text-danger hover:bg-danger/5 text-sm font-medium transition cursor-pointer"
          >
            <i className="bx bx-log-out text-lg" /> Sign out
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-ink">Are you sure?</p>
            <button
              onClick={logout}
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
