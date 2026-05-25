import { useState } from "react";
import ScanForm from "../components/dashboard/ScanForm";
import ScoreGauge from "../components/dashboard/ScoreGauge";
import VerdictBadge from "../components/dashboard/VerdictBadge";
import ReasonCards from "../components/dashboard/ReasonCards";
import LayerBreakdown from "../components/dashboard/LayerBreakdown";

// Placeholder shape — replace with real API types from api/client.ts
interface AnalysisResponse {
  risk_score: number;
  verdict: "clean" | "suspicious" | "phishing";
  top_reasons: string[];
  layers: { name: string; score: number; reasons: string[]; weight: number }[];
  scan_id: string;
}

// Mock response for UI development — remove when API is wired
const MOCK: AnalysisResponse = {
  risk_score: 82,
  verdict: "phishing",
  top_reasons: [
    "Domain registered 2 days ago (WHOIS)",
    "SPF check failed — sending server not authorised",
    "Credential harvesting language detected by AI",
  ],
  layers: [
    { name: "URL Analysis", score: 0.88, reasons: ["Domain age: 2 days", "Listed on URLhaus"], weight: 0.35 },
    { name: "NLP / AI", score: 0.79, reasons: ["High credential harvesting score", "Urgency language detected"], weight: 0.40 },
    { name: "Headers", score: 0.70, reasons: ["SPF: fail", "DMARC: fail"], weight: 0.25 },
  ],
  scan_id: "mock-uuid-001",
};

export default function AnalyzerPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setResult(null);
    setFeedbackSent(false);
    // TODO: replace with real API call
    await new Promise((r) => setTimeout(r, 1500));
    setResult(MOCK);
    setLoading(false);
  };

  const handleFeedback = async () => {
    // TODO: POST to /feedback
    setFeedbackSent(true);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Scan for Threats</h1>
        <p className="text-ink-muted text-sm mt-1">Paste a URL or email content to run a multi-layer phishing analysis.</p>
      </div>

      {/* Scan form card */}
      <div className="bg-canvas border border-outline rounded-2xl p-6 shadow-sm">
        <ScanForm onSubmit={handleSubmit} loading={loading} />
        {loading && (
          <p className="mt-4 text-sm text-ink-muted flex items-center gap-2">
            <i className="bx bx-loader-alt animate-spin text-brand-500" />
            Analysis in progress — this usually takes 2–4 seconds…
          </p>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5 animate-fade-in">
          {/* Score + verdict */}
          <div className="bg-canvas border border-outline rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
            <ScoreGauge score={result.risk_score} />
            <div className="flex-1 space-y-3">
              <VerdictBadge verdict={result.verdict} />
              <p className="text-sm text-ink-muted">
                Risk score <span className="font-semibold text-ink">{result.risk_score}/100</span> based on {result.layers.length} detection layers.
              </p>
            </div>
          </div>

          {/* Top reasons */}
          <div className="bg-canvas border border-outline rounded-2xl p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <i className="bx bx-list-ul text-brand-500 text-lg" /> Top Reasons
            </h2>
            <ReasonCards reasons={result.top_reasons} />
          </div>

          {/* Layer breakdown */}
          <div className="bg-canvas border border-outline rounded-2xl p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <i className="bx bx-layer text-brand-500 text-lg" /> Layer Breakdown
            </h2>
            <LayerBreakdown layers={result.layers} />
          </div>

          {/* False positive report */}
          <div className="flex justify-end">
            {feedbackSent ? (
              <span className="text-sm text-safe flex items-center gap-1.5">
                <i className="bx bx-check-circle" /> Feedback submitted — thank you
              </span>
            ) : (
              <button
                onClick={handleFeedback}
                className="text-sm text-ink-muted hover:text-danger transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="bx bx-flag" /> Report incorrect result
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
