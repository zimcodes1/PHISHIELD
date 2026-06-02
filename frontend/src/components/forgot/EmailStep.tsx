interface Props {
  onSuccess: (email: string) => void;
}

import { useState } from "react";

export default function EmailStep({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    // TODO: POST /auth/forgot-password { email }
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    onSuccess(email);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center">
          <i className="bx bx-envelope text-3xl text-brand-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-ink">Forgot your password?</h2>
          <p className="text-ink-muted text-sm mt-1">
            Enter your account email and we'll send you a reset code.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Email address</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
              <i className="bx bx-envelope text-lg" />
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition text-sm"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-danger flex items-center gap-1.5">
            <i className="bx bx-x-circle" /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold text-sm transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <><i className="bx bx-loader-alt animate-spin text-lg" /> Sending code…</>
          ) : (
            <><i className="bx bx-send text-lg" /> Send reset code</>
          )}
        </button>
      </form>
    </div>
  );
}
