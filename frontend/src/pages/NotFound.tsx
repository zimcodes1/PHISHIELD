import { Link } from "react-router-dom";
import { LogoIcon } from "../components/CustomIcons";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-subtle flex flex-col items-center justify-center px-6 text-center">

      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <LogoIcon className="w-8 h-8 text-brand-500" />
        <span className="text-xl font-bold text-ink">PhishShield</span>
      </div>

      {/* Illustration */}
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full bg-brand-50 flex items-center justify-center mx-auto">
          <i className="bx bx-shield-x text-7xl text-brand-300" />
        </div>
        <span className="absolute -top-2 -right-2 bg-danger text-white text-xs font-bold px-2 py-1 rounded-full shadow">
          404
        </span>
      </div>

      <h1 className="text-4xl font-extrabold text-ink mb-2">Page not found</h1>
      <p className="text-ink-muted text-base max-w-sm mb-8">
        The page you're looking for doesn't exist or has been moved. Let's get you back on track.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition shadow-md"
        >
          <i className="bx bx-home-alt-2 text-lg" /> Go to Dashboard
        </Link>
        <Link
          to="/login"
          className="flex items-center gap-2 px-6 py-3 rounded-xl border border-outline text-ink-muted hover:text-ink hover:border-brand-300 text-sm font-medium transition"
        >
          <i className="bx bx-log-in text-lg" /> Sign in
        </Link>
      </div>
    </div>
  );
}
