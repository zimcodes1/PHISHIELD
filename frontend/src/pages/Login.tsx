import { useEffect, useState } from "react";
import { EyeIcon, EyeOffIcon, LogoIcon } from "../components/CustomIcons";
import { useAuth } from "../context/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Set page title
  useEffect(()=>{
    document.title = 'PhishShield | Login to Account'
  },[])

  const { login } = useAuth();

  //Form submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, password);
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

          <h2 className="text-3xl font-bold text-ink mb-1">Welcome back</h2>
          <p className="text-ink-muted mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="block text-sm font-medium text-ink">Password</label>
                <a href="/forgot-password" className="text-sm text-brand-500 hover:text-brand-600">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition pr-12"
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

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold text-base transition shadow-md cursor-pointer"
            >
              Sign in
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Don't have an account?{" "}
            <a href="/signup" className="text-brand-500 font-medium hover:text-brand-600">
              Create one
            </a>
          </p>
        </div>
      </div>

      {/* ── Right column: Branding ── */}
      <div className="flex-1 hidden lg:flex flex-col items-center justify-center bg-linear-to-br from-brand-400 to-brand-600 px-12 py-16 text-white">
        <LogoIcon className="w-20 h-20 mb-6 opacity-90" />
        <h1 className="text-4xl font-extrabold mb-3 tracking-tight">PhishShield</h1>
        <p className="text-brand-100 text-lg text-center max-w-xs mb-10">
          AI-powered phishing detection for email and web — stay safe, stay informed.
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
