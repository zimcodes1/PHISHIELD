import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { analyzeURL, analyzeEmail, analyzeEML } from "../api/authService";
import type { AnalysisResponse } from "../api/types";
import ScanForm from "../components/dashboard/ScanForm";
import ScoreGauge from "../components/dashboard/ScoreGauge";
import VerdictBadge from "../components/dashboard/VerdictBadge";
import ReasonCards from "../components/dashboard/ReasonCards";
import LayerBreakdown from "../components/dashboard/LayerBreakdown";
import { Alert } from "../components/Toast";
import axios from "axios";
import Preloader from "../components/Preloader";
import { waitForMinimumDuration } from "../utils/minimumDelay";
import ProfileLink from "../components/dashboard/ProfileLink";

// Backend returns "Clean" | "Suspicious" | "Phishing" — components expect lowercase
type NormalisedVerdict = "clean" | "suspicious" | "phishing";
const normaliseVerdict = (v: AnalysisResponse["verdict"]): NormalisedVerdict =>
  v.toLowerCase() as NormalisedVerdict;

type ScanFormData =
  | { type: "url"; url: string }
  | { type: "email"; subject: string; sender: string; body: string; headers: string }
  | { type: "eml"; file: File };

export default function AnalyzerPage() {
  const { access_token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => { document.title = "PhishShield | Analyze"; }, []);

  const handleSubmit = async (data: ScanFormData) => {
    if (!access_token) return;
    const startedAt = Date.now();
    setLoading(true);
    setResult(null);
    setError(null);
    setFeedbackSent(false);

    try {
      let response: AnalysisResponse;

      if (data.type === "url") {
        response = await analyzeURL(data.url, access_token);
      } else if (data.type === "eml") {
        response = await analyzeEML(data.file, access_token);
      } else {
        response = await analyzeEmail(
          data.subject,
          data.body,
          data.sender,
          data.headers || undefined,
          access_token
        );
      }

      setResult(response);
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "Analysis failed. Please try again.");
    } finally {
      await waitForMinimumDuration(startedAt);
      setLoading(false);
    }
  };

  const handleFeedback = () => {
    // TODO: POST /feedback with result.scan_id
    setFeedbackSent(true);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

      <div className="flex items-start justify-between gap-4 max-sm:relative">
        <div className="max-sm:mt-5">
          <h1 className="text-2xl font-bold text-ink">Scan for Threats</h1>
          <p className="text-ink-muted text-sm mt-1">
            Paste a URL or email content to run a multi-layer phishing analysis.
          </p>
        </div>
        <ProfileLink />
      </div>

      {/* Scan form */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <ScanForm onSubmit={handleSubmit} loading={loading} />
        {loading && <Preloader message="Analysis in progress..." />}
        {error && <Alert variant="error" message={error} onDismiss={() => setError(null)} />}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">

          {/* Score + verdict */}
          <div className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
            <ScoreGauge score={result.risk_score} />
            <div className="flex-1 space-y-3">
              <VerdictBadge verdict={normaliseVerdict(result.verdict)} />
              <p className="text-sm text-ink-muted">
                Risk score{" "}
                <span className="font-semibold text-ink">{result.risk_score}/100</span>{" "}
                based on{" "}
                <span className="font-semibold text-ink">{result.layers_list.length}</span>{" "}
                detection layers.
              </p>
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <i className="bx bx-time-five text-brand-400" />
                Scanned {new Date(result.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Top reasons */}
          {result.top_reasons.length > 0 && (
            <div className="glass-card rounded-2xl p-6 space-y-3">
              <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                <i className="bx bx-list-ul text-brand-500 text-lg" /> Top Reasons
              </h2>
              <ReasonCards reasons={result.top_reasons} />
            </div>
          )}

          {/* Layer breakdown */}
          {result.layers_list.length > 0 && (
            <div className="glass-card rounded-2xl p-6 space-y-3">
              <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                <i className="bx bx-layer text-brand-500 text-lg" /> Layer Breakdown
              </h2>
              <LayerBreakdown layers={result.layers_list} />
            </div>
          )}

          {/* Feedback */}
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
