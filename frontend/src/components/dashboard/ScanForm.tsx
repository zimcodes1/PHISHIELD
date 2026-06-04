import { useRef, useState } from "react";

type Tab = "url" | "email";
type EmailMode = "manual" | "upload";

interface EmailForm {
	subject: string;
	sender: string;
	body: string;
	headers: string;
}

interface Props {
	onSubmit: (
		data:
			| { type: "url"; url: string }
			| ({ type: "email" } & EmailForm)
			| { type: "eml"; file: File },
	) => void;
	loading: boolean;
}

export default function ScanForm({ onSubmit, loading }: Props) {
	const [tab, setTab] = useState<Tab>("email");
	const [emailMode, setEmailMode] = useState<EmailMode>("manual");
	const [url, setUrl] = useState("");
	const [email, setEmail] = useState<EmailForm>({
		subject: "",
		sender: "",
		body: "",
		headers: "",
	});
	const [showHeaders, setShowHeaders] = useState(false);
	const [emlFile, setEmlFile] = useState<File | null>(null);
	const [dragging, setDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const setEmailField =
		(field: keyof EmailForm) =>
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			setEmail((prev) => ({ ...prev, [field]: e.target.value }));

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (tab === "url") {
			onSubmit({ type: "url", url });
		} else if (emailMode === "upload" && emlFile) {
			onSubmit({ type: "eml", file: emlFile });
		} else {
			onSubmit({ type: "email", ...email });
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDragging(false);
		const f = e.dataTransfer.files[0];
		if (f?.name.endsWith(".eml")) setEmlFile(f);
	};

	const inputClass =
		"w-full px-4 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition text-sm";

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{/* Main tab switcher: URL / Email */}
			<div className="flex gap-1 bg-subtle border border-outline rounded-xl p-1 w-fit max-sm:w-full max-sm:justify-between">
				{(["url", "email"] as Tab[]).map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTab(t)}
						className={`px-5 max-sm:px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
							tab === t
								? "bg-brand-500 text-white shadow-sm"
								: "text-ink-muted hover:text-ink"
						}`}
					>
						<i
							className={`bx ${t === "url" ? "bx-link" : "bx-envelope"} mr-1.5`}
						/>
						{t === "url" ? "Check URL" : "Analyze Email"}
					</button>
				))}
			</div>

			{tab === "url" ? (
				<div className="flex gap-3">
					<input
						type="text"
						required
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://suspicious-site.com/login"
						className={`${inputClass} flex-1`}
					/>
					<SubmitButton loading={loading} />
				</div>
			) : (
				<div className="space-y-4">
					{/* Email input mode switcher */}
					<div className="flex gap-1 bg-subtle border border-outline rounded-xl p-1 w-fit">
						{(["manual", "upload"] as EmailMode[]).map((m) => (
							<button
								key={m}
								type="button"
								onClick={() => setEmailMode(m)}
								className={`px-4 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
									emailMode === m
										? "bg-brand-500 text-white shadow-sm"
										: "text-ink-muted hover:text-ink"
								}`}
							>
								<i
									className={`bx ${m === "manual" ? "bx-edit" : "bx-upload"} mr-1`}
								/>
								{m === "manual" ? "Fill manually" : "Upload .eml file"}
							</button>
						))}
					</div>

					{emailMode === "manual" ? (
						<div className="space-y-3">
							<div className="grid grid-cols-2 gap-3">
								<input
									type="text"
									required
									value={email.subject}
									onChange={setEmailField("subject")}
									placeholder="Email subject"
									className={inputClass}
								/>
								<input
									type="text"
									required
									value={email.sender}
									onChange={setEmailField("sender")}
									placeholder="Sender address"
									className={inputClass}
								/>
							</div>
							<textarea
								required
								rows={5}
								value={email.body}
								onChange={setEmailField("body")}
								placeholder="Paste email body here..."
								className={`${inputClass} resize-none`}
							/>
							<button
								type="button"
								onClick={() => setShowHeaders(!showHeaders)}
								className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand-500 transition cursor-pointer"
							>
								<i
									className={`bx ${showHeaders ? "bx-chevron-up" : "bx-chevron-down"}`}
								/>
								{showHeaders ? "Hide" : "Paste"} raw email headers (optional)
							</button>
							{showHeaders && (
								<textarea
									rows={4}
									value={email.headers}
									onChange={setEmailField("headers")}
									placeholder="Paste raw headers..."
									className={`${inputClass} resize-none font-mono text-xs`}
								/>
							)}
						</div>
					) : (
						<div className="space-y-3">
							{/* Drop zone */}
							<div
								onClick={() => fileInputRef.current?.click()}
								onDragOver={(e) => {
									e.preventDefault();
									setDragging(true);
								}}
								onDragLeave={() => setDragging(false)}
								onDrop={handleDrop}
								className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl px-6 py-10 cursor-pointer transition select-none ${
									dragging
										? "border-brand-400 bg-brand-50"
										: emlFile
											? "border-safe bg-safe/5"
											: "border-outline bg-subtle hover:border-brand-300 hover:bg-brand-50/40"
								}`}
							>
								{emlFile ? (
									<>
										<i className="bx bx-file text-4xl text-safe" />
										<div className="text-center">
											<p className="text-sm font-medium text-ink">
												{emlFile.name}
											</p>
											<p className="text-xs text-ink-muted mt-0.5">
												{(emlFile.size / 1024).toFixed(1)} KB
											</p>
										</div>
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												setEmlFile(null);
												if (fileInputRef.current)
													fileInputRef.current.value = "";
											}}
											className="text-xs text-danger hover:underline cursor-pointer"
										>
											Remove file
										</button>
									</>
								) : (
									<>
										<i
											className={`bx bx-cloud-upload text-4xl ${dragging ? "text-brand-500" : "text-ink-muted"}`}
										/>
										<div className="text-center">
											<p className="text-sm font-medium text-ink">
												Drop your .eml file here
											</p>
											<p className="text-xs text-ink-muted mt-1">
												or click to browse
											</p>
										</div>
									</>
								)}
							</div>
							<input
								ref={fileInputRef}
								type="file"
								accept=".eml"
								className="hidden"
								onChange={(e) => {
									const f = e.target.files?.[0];
									if (f) setEmlFile(f);
								}}
							/>
						</div>
					)}

					<SubmitButton
						loading={loading}
						disabled={emailMode === "upload" && !emlFile}
					/>
				</div>
			)}
		</form>
	);
}

function SubmitButton({
	loading,
	disabled = false,
}: {
	loading: boolean;
	disabled?: boolean;
}) {
	return (
		<button
			type="submit"
			disabled={loading || disabled}
			className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold text-sm transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
		>
			{loading ? (
				<>
					<i className="bx bx-loader-alt animate-spin text-lg" /> Analyzing…
				</>
			) : (
				<>
					<i className="bx bx-search-alt text-lg" /> Analyze
				</>
			)}
		</button>
	);
}
