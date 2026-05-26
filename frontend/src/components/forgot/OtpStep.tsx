import { useRef, useState } from "react";

interface Props {
  email: string;
  onSuccess: () => void;
}

const OTP_LENGTH = 4;

export default function OtpStep({ email, onSuccess }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const focusNext = (i: number) => inputs.current[i + 1]?.focus();
  const focusPrev = (i: number) => inputs.current[i - 1]?.focus();

  const handleChange = (i: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    setError("");
    if (char) focusNext(i);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i]) focusPrev(i);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    const next = [...digits];
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    inputs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < OTP_LENGTH) { setError("Please enter all 4 digits."); return; }
    setLoading(true);
    setError("");
    // TODO: POST /auth/verify-otp { email, code }
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    // Simulate wrong code for demo — remove when API is wired
    if (code === "0000") { setError("Incorrect code. Please try again."); return; }
    onSuccess();
  };

  const handleResend = async () => {
    // TODO: POST /auth/forgot-password { email }
    setResent(true);
    setDigits(Array(OTP_LENGTH).fill(""));
    inputs.current[0]?.focus();
    setTimeout(() => setResent(false), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center">
          <i className="bx bx-lock-open text-3xl text-brand-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-ink">Check your inbox</h2>
          <p className="text-ink-muted text-sm mt-1">
            We sent a 4-digit code to <span className="font-medium text-ink">{email}</span>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* OTP boxes */}
        <div className="flex justify-center gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={`w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-subtle text-ink focus:outline-none transition
                ${d ? "border-brand-400 bg-brand-50" : "border-outline"}
                focus:border-brand-500 focus:ring-2 focus:ring-brand-200`}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-danger flex items-center justify-center gap-1.5">
            <i className="bx bx-x-circle" /> {error}
          </p>
        )}

        {resent && (
          <p className="text-sm text-safe flex items-center justify-center gap-1.5">
            <i className="bx bx-check-circle" /> Code resent successfully.
          </p>
        )}

        <button
          type="submit"
          disabled={loading || digits.join("").length < OTP_LENGTH}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold text-sm transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <><i className="bx bx-loader-alt animate-spin text-lg" /> Verifying…</>
          ) : (
            <><i className="bx bx-check-shield text-lg" /> Verify code</>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-ink-muted">
        Didn't receive it?{" "}
        <button
          type="button"
          onClick={handleResend}
          className="text-brand-500 font-medium hover:text-brand-600 cursor-pointer"
        >
          Resend code
        </button>
      </p>
    </div>
  );
}
