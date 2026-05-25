import { useState } from "react";
import { CheckIcon, EyeIcon, EyeOffIcon, LockIcon, LogoIcon, MailIcon, UserIcon } from "../components/CustomIcons";

export default function SignupPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const passwordRules = [
    { label: "At least 8 characters", met: form.password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(form.password) },
    { label: "Passwords match", met: form.password.length > 0 && form.password === form.confirm },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up auth
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left column: Form ── */}
      <div className="flex-1 flex items-center justify-center bg-canvas px-8 py-12">
        <div className="w-full max-w-md">

          {/* Mobile-only logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <LogoIcon className="w-8 h-8 text-brand-500" />
            <span className="text-xl font-bold text-ink">PhishShield</span>
          </div>

          <h2 className="text-3xl font-bold text-ink mb-1">Create an account</h2>
          <p className="text-ink-muted mb-8">Start protecting yourself from phishing today</p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Full name */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Full name</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
                  <UserIcon />
                </span>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={set("name")}
                  placeholder="John Doe"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Email address</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
                  <MailIcon />
                </span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={set("password")}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Confirm password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
                  <LockIcon />
                </span>
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  value={form.confirm}
                  onChange={set("confirm")}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Password rules */}
            {form.password.length > 0 && (
              <ul className="space-y-1.5">
                {passwordRules.map(({ label, met }) => (
                  <li key={label} className={`flex items-center gap-2 text-sm ${met ? "text-safe" : "text-ink-muted"}`}>
                    <span className={`flex items-center justify-center w-4 h-4 rounded-full ${met ? "bg-safe text-white" : "bg-outline"}`}>
                      <CheckIcon />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold text-base transition shadow-md cursor-pointer"
            >
              Create account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Already have an account?{" "}
            <a href="/login" className="text-brand-500 font-medium hover:text-brand-600">
              Sign in
            </a>
          </p>
        </div>
      </div>

      {/* ── Right column: Branding ── */}
      <div className="flex-1 hidden lg:flex flex-col items-center justify-center bg-gradient-to-br from-brand-400 to-brand-600 px-12 py-16 text-white">
        <LogoIcon className="w-20 h-20 mb-6 opacity-90" />
        <h1 className="text-4xl font-extrabold mb-3 tracking-tight">PhishShield</h1>
        <p className="text-brand-100 text-lg text-center max-w-xs mb-10">
          Join thousands staying protected against phishing attacks every day.
        </p>

        <div className="space-y-3 w-full max-w-xs">
          {[
            { icon: "🔍", label: "Real-time URL scanning" },
            { icon: "🧠", label: "AI-powered NLP analysis" },
            { icon: "📧", label: "Email header verification" },
            { icon: "🛡️", label: "Multi-layer ensemble scoring" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 bg-white/15 rounded-xl px-4 py-3 backdrop-blur-sm"
            >
              <span className="text-xl">{icon}</span>
              <span className="text-sm font-medium text-brand-50">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
