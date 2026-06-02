import { useState } from "react";
import { Link } from "react-router-dom";
import { LogoIcon } from "../components/CustomIcons";
import EmailStep from "../components/forgot/EmailStep";
import OtpStep from "../components/forgot/OtpStep";
import NewPasswordStep from "../components/forgot/NewPasswordStep";

type Step = "email" | "otp" | "password" | "done";

const STEPS = [
  { key: "email",    label: "Email",       icon: "bx-envelope"     },
  { key: "otp",      label: "Verify",      icon: "bx-lock-open"    },
  { key: "password", label: "New Password",icon: "bx-lock"         },
];

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-subtle flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <Link to="/login" className="flex items-center gap-2 mb-8">
        <LogoIcon className="w-8 h-8 text-brand-500" />
        <span className="text-xl font-bold text-ink">PhishShield</span>
      </Link>

      <div className="w-full max-w-md bg-canvas border border-outline rounded-2xl shadow-sm p-8 space-y-8">

        {/* Progress stepper */}
        {step !== "done" && (
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <div key={s.key} className="w-full flex items-center justify-evenly">
                  {/* Circle */}
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all
                      ${done   ? "bg-safe text-white"
                      : active ? "bg-brand-500 text-white shadow-md shadow-brand-200"
                      :          "bg-outline text-ink-muted"}`}
                    >
                      {done
                        ? <i className="bx bx-check text-lg" />
                        : <i className={`bx ${s.icon} text-base`} />
                      }
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Step content */}
        {step === "email" && (
          <EmailStep onSuccess={(e) => { setEmail(e); setStep("otp"); }} />
        )}
        {step === "otp" && (
          <OtpStep email={email} onSuccess={() => setStep("password")} />
        )}
        {step === "password" && (
          <NewPasswordStep onSuccess={() => setStep("done")} />
        )}
        {step === "done" && (
          <div className="flex flex-col items-center gap-4 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-safe/15 flex items-center justify-center">
              <i className="bx bx-check-circle text-4xl text-safe" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-ink">Password updated!</h2>
              <p className="text-ink-muted text-sm mt-1">Your password has been reset successfully.</p>
            </div>
            <Link
              to="/login"
              className="mt-2 flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition shadow-md"
            >
              <i className="bx bx-log-in text-lg" /> Back to sign in
            </Link>
          </div>
        )}
      </div>

      {/* Back link */}
      {step !== "done" && (
        <Link to="/login" className="mt-6 text-sm text-ink-muted hover:text-brand-500 flex items-center gap-1.5 transition">
          <i className="bx bx-arrow-back" /> Back to sign in
        </Link>
      )}
    </div>
  );
}
