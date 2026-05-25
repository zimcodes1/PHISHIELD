import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up auth
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left column: Form ── */}
      <div className="flex-1 flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-md">

          {/* Mobile-only logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <ShieldIcon className="w-8 h-8 text-blue-500" />
            <span className="text-xl font-bold text-gray-800">PhishShield</span>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-gray-500 mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <a href="#" className="text-sm text-blue-500 hover:text-blue-600">
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold text-base transition shadow-md shadow-blue-200 cursor-pointer"
            >
              Sign in
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <a href="#" className="text-blue-500 font-medium hover:text-blue-600">
              Create one
            </a>
          </p>
        </div>
      </div>

      {/* ── Right column: Branding ── */}
      <div className="flex-1 hidden lg:flex flex-col items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 px-12 py-16 text-white">
        <ShieldIcon className="w-20 h-20 mb-6 opacity-90" />
        <h1 className="text-4xl font-extrabold mb-3 tracking-tight">PhishShield</h1>
        <p className="text-blue-100 text-lg text-center max-w-xs mb-10">
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
              <span className="text-sm font-medium text-blue-50">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6l-9-4zm-1 13l-3-3 1.41-1.41L11 13.17l4.59-4.58L17 10l-6 5z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
