import { useEffect, useState } from "react";
import axios from "axios";
import {
	CheckIcon,
	EyeIcon,
	EyeOffIcon,
	LockIcon,
	LogoIcon,
	MailIcon,
	UserIcon,
} from "../components/CustomIcons";
import { Alert } from "../components/Toast";
import { useAuth } from "../context/useAuth";
import { getPasswordRules, validatePasswordRules } from "../utils/passwordRules";

// ── Validation helpers ────────────────────────────────────────────────────────

// Strip HTML tags and null bytes to prevent stored XSS / injection
const sanitize = (val: string) => val.replace(/<[^>]*>/g, "").replace(/\0/g, "").trim();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateForm(name: string, email: string, password: string, confirm: string): string | null {
	if (!sanitize(name) || sanitize(name).length < 2)
		return "Full name must be at least 2 characters.";
	if (sanitize(name).length > 100)
		return "Full name is too long.";
	if (!EMAIL_RE.test(sanitize(email)))
		return "Please enter a valid email address.";
	return validatePasswordRules(password, confirm);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SignupPage() {
	const { register } = useAuth();

	const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => { document.title = "PhishShield | Create Account"; }, []);

	const set = (field: keyof typeof form) =>
		(e: React.ChangeEvent<HTMLInputElement>) => {
			// Clear error as soon as user edits any field
			setError(null);
			setForm((prev) => ({ ...prev, [field]: e.target.value }));
		};

	const passwordRules = getPasswordRules(form.password, form.confirm);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const validationError = validateForm(form.name, form.email, form.password, form.confirm);
		if (validationError) { setError(validationError); return; }

		setLoading(true);
		setError(null);
		try {
			// useAuth.register signature: (email, fullname, password)
			await register(sanitize(form.email), sanitize(form.name), form.password);
		} catch (err: unknown) {
			const detail = axios.isAxiosError(err)
				? err.response?.data?.detail
				: null;
			setError(
				typeof detail === "string"
					? detail
					: "Registration failed. Please try again."
			);
		} finally {
			setLoading(false);
		}
	};

	const inputBase =
		"w-full py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition text-sm";

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

					<form onSubmit={handleSubmit} className="space-y-5" noValidate>

						{/* Full name */}
						<div>
							<label className="block text-sm font-medium text-ink mb-1">Full name</label>
							<div className="relative">
								<span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"><UserIcon /></span>
								<input
									type="text"
									required
									maxLength={100}
									autoComplete="name"
									value={form.name}
									onChange={set("name")}
									placeholder="John Doe"
									className={`${inputBase} pl-11 pr-4`}
								/>
							</div>
						</div>

						{/* Email */}
						<div>
							<label className="block text-sm font-medium text-ink mb-1">Email address</label>
							<div className="relative">
								<span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"><MailIcon /></span>
								<input
									type="email"
									required
									maxLength={254}
									autoComplete="email"
									value={form.email}
									onChange={set("email")}
									placeholder="you@example.com"
									className={`${inputBase} pl-11 pr-4`}
								/>
							</div>
						</div>

						{/* Password */}
						<div>
							<label className="block text-sm font-medium text-ink mb-1">Password</label>
							<div className="relative">
								<span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"><LockIcon /></span>
								<input
									type={showPassword ? "text" : "password"}
									required
									autoComplete="new-password"
									value={form.password}
									onChange={set("password")}
									placeholder="••••••••"
									className={`${inputBase} pl-11 pr-12`}
								/>
								<button type="button" onClick={() => setShowPassword(!showPassword)}
									className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer">
									{showPassword ? <EyeOffIcon /> : <EyeIcon />}
								</button>
							</div>
						</div>

						{/* Confirm password */}
						<div>
							<label className="block text-sm font-medium text-ink mb-1">Confirm password</label>
							<div className="relative">
								<span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"><LockIcon /></span>
								<input
									type={showConfirm ? "text" : "password"}
									required
									autoComplete="new-password"
									value={form.confirm}
									onChange={set("confirm")}
									placeholder="••••••••"
									className={`${inputBase} pl-11 pr-12`}
								/>
								<button type="button" onClick={() => setShowConfirm(!showConfirm)}
									className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer">
									{showConfirm ? <EyeOffIcon /> : <EyeIcon />}
								</button>
							</div>
						</div>

						{/* Live password rules */}
						{form.password.length > 0 && (
							<ul className="space-y-1.5">
								{passwordRules.map(({ label, met }) => (
									<li key={label} className={`flex items-center gap-2 text-sm ${met ? "text-safe" : "text-ink-muted"}`}>
										<span className={`flex items-center justify-center w-4 h-4 rounded-full shrink-0 ${met ? "bg-safe text-white" : "bg-outline"}`}>
											<CheckIcon />
										</span>
										{label}
									</li>
								))}
							</ul>
						)}

						{/* Inline error alert */}
						{error && (
							<Alert variant="error" message={error} onDismiss={() => setError(null)} />
						)}

						<button
							type="submit"
							disabled={loading}
							className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold text-base transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
						>
							{loading ? (
								<><i className="bx bx-loader-alt animate-spin text-lg" /> Creating account…</>
							) : (
								<><i className="bx bx-user-plus text-lg" /> Create account</>
							)}
						</button>
					</form>

					<p className="mt-6 text-center text-sm text-ink-muted">
						Already have an account?{" "}
						<a href="/login" className="text-brand-500 font-medium hover:text-brand-600">Sign in</a>
					</p>
				</div>
			</div>

			{/* ── Right column: Branding ── */}
			<div className="flex-1 hidden lg:flex flex-col items-center justify-center bg-linear-to-br from-brand-400 to-brand-600 px-12 py-16 text-white">
				<LogoIcon className="w-20 h-20 mb-6 opacity-90" />
				<h1 className="text-4xl font-extrabold mb-3 tracking-tight">PhishShield</h1>
				<p className="text-brand-100 text-lg text-center max-w-xs mb-10">
					Join thousands staying protected against phishing attacks every day.
				</p>
				<div className="space-y-3 w-full max-w-xs">
					{[
						{ icon: "bx-search",       label: "Real-time URL scanning" },
						{ icon: "bx-brain",        label: "AI-powered NLP analysis" },
						{ icon: "bx-envelope",     label: "Email header verification" },
						{ icon: "bx-check-shield", label: "Multi-layer ensemble scoring" },
					].map(({ icon, label }) => (
						<div key={label} className="flex items-center gap-3 bg-white/15 rounded-xl px-4 py-3 backdrop-blur-sm">
							<i className={`bx ${icon} text-xl`} />
							<span className="text-sm font-medium text-brand-50">{label}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
