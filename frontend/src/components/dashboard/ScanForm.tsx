import { useState } from "react";

type Tab = "url" | "email";

interface EmailForm {
  subject: string;
  sender: string;
  body: string;
  headers: string;
}

interface Props {
  onSubmit: (data: { type: "url"; url: string } | { type: "email" } & EmailForm) => void;
  loading: boolean;
}

export default function ScanForm({ onSubmit, loading }: Props) {
  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState<EmailForm>({ subject: "", sender: "", body: "", headers: "" });
  const [showHeaders, setShowHeaders] = useState(false);

  const setEmailField = (field: keyof EmailForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEmail((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "url") onSubmit({ type: "url", url });
    else onSubmit({ type: "email", ...email });
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-outline bg-subtle text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-subtle border border-outline rounded-xl p-1 w-fit">
        {(["url", "email"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              tab === t ? "bg-brand-500 text-white shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            <i className={`bx ${t === "url" ? "bx-link" : "bx-envelope"} mr-1.5`} />
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
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" required value={email.subject} onChange={setEmailField("subject")} placeholder="Email subject" className={inputClass} />
            <input type="text" required value={email.sender} onChange={setEmailField("sender")} placeholder="Sender address" className={inputClass} />
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
            <i className={`bx ${showHeaders ? "bx-chevron-up" : "bx-chevron-down"}`} />
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
          <SubmitButton loading={loading} />
        </div>
      )}
    </form>
  );
}

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold text-sm transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
    >
      {loading ? (
        <><i className="bx bx-loader-alt animate-spin text-lg" /> Analyzing…</>
      ) : (
        <><i className="bx bx-search-alt text-lg" /> Analyze</>
      )}
    </button>
  );
}
