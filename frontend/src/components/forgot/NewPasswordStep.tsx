import { useState } from "react";
import { CheckIcon, EyeIcon, EyeOffIcon } from "../CustomIcons";

interface Props {
  onSuccess: () => void;
}

export default function NewPasswordStep({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number",     met: /\d/.test(password) },
    { label: "Passwords match",       met: password.length > 0 && password === confirm },
  ];
  const allMet = rules.every((r) => r.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet) { setError("Please satisfy all requirements."); return; }
    setError("");
    setLoading(true);
    // TODO: POST /auth/reset-password { password }
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    onSuccess();
  };

  const inputClass =
    "w-full pl-4 pr-12 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition text-sm";

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center">
          <i className="bx bx-lock text-3xl text-brand-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-ink">Set new password</h2>
          <p className="text-ink-muted text-sm mt-1">Choose a strong password for your account.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New password */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">New password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="••••••••"
              className={inputClass}
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Confirm password</label>
          <div className="relative">
            <input
              type={showCf ? "text" : "password"}
              required
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(""); }}
              placeholder="••••••••"
              className={inputClass}
            />
            <button type="button" onClick={() => setShowCf(!showCf)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
              {showCf ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {/* Strength rules */}
        {password.length > 0 && (
          <ul className="space-y-1.5">
            {rules.map(({ label, met }) => (
              <li key={label} className={`flex items-center gap-2 text-sm ${met ? "text-safe" : "text-ink-muted"}`}>
                <span className={`flex items-center justify-center w-4 h-4 rounded-full shrink-0 ${met ? "bg-safe text-white" : "bg-outline"}`}>
                  <CheckIcon />
                </span>
                {label}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="text-sm text-danger flex items-center gap-1.5">
            <i className="bx bx-x-circle" /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !allMet}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold text-sm transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <><i className="bx bx-loader-alt animate-spin text-lg" /> Saving…</>
          ) : (
            <><i className="bx bx-check text-lg" /> Save new password</>
          )}
        </button>
      </form>
    </div>
  );
}
