import { useState } from "react";
import VerdictBadge from "../components/dashboard/VerdictBadge";
import LayerBreakdown from "../components/dashboard/LayerBreakdown";

type Verdict = "clean" | "suspicious" | "phishing";
type ScanType = "url" | "email";

interface Scan {
  id: string;
  scan_type: ScanType;
  input_value: string;
  risk_score: number;
  verdict: Verdict;
  timestamp: string;
  reasons: string[];
  layers: { name: string; score: number; reasons: string[]; weight: number }[];
}

// Mock data — replace with real API call
const MOCK_SCANS: Scan[] = Array.from({ length: 14 }, (_, i) => ({
  id: `scan-${i}`,
  scan_type: i % 3 === 0 ? "email" : "url",
  input_value: i % 3 === 0 ? `suspicious-email-subject-${i}@attacker.com` : `https://fake-bank-login-${i}.tk/verify`,
  risk_score: [82, 55, 20, 91, 38, 74, 15, 63, 88, 22, 47, 79, 10, 66][i],
  verdict: ([82, 91, 74, 88, 79].includes([82, 55, 20, 91, 38, 74, 15, 63, 88, 22, 47, 79, 10, 66][i]) ? "phishing" : [55, 38, 63, 47, 66].includes([82, 55, 20, 91, 38, 74, 15, 63, 88, 22, 47, 79, 10, 66][i]) ? "suspicious" : "clean") as Verdict,
  timestamp: new Date(Date.now() - i * 3600000 * 2).toISOString(),
  reasons: ["Domain registered 2 days ago", "SPF check failed"],
  layers: [
    { name: "URL Analysis", score: 0.8, reasons: ["Domain age: 2 days"], weight: 0.35 },
    { name: "NLP / AI", score: 0.75, reasons: ["Urgency language"], weight: 0.40 },
  ],
}));

const PAGE_SIZE = 8;

const relativeTime = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function HistoryPage() {
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ScanType | "all">("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = MOCK_SCANS.filter(
    (s) => (verdictFilter === "all" || s.verdict === verdictFilter) && (typeFilter === "all" || s.scan_type === typeFilter)
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: MOCK_SCANS.length,
    phishing: MOCK_SCANS.filter((s) => s.verdict === "phishing").length,
    suspicious: MOCK_SCANS.filter((s) => s.verdict === "suspicious").length,
    clean: MOCK_SCANS.filter((s) => s.verdict === "clean").length,
  };

  const scoreColor = (score: number) =>
    score >= 70 ? "text-danger font-semibold" : score >= 40 ? "text-caution font-semibold" : "text-safe font-semibold";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Scan History</h1>
        <p className="text-ink-muted text-sm mt-1">All your past analyses, most recent first.</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Scans", value: stats.total, icon: "bx-scan", color: "text-brand-500" },
          { label: "Phishing Blocked", value: stats.phishing, icon: "bx-shield-x", color: "text-danger" },
          { label: "Suspicious", value: stats.suspicious, icon: "bx-error", color: "text-caution" },
          { label: "Clean", value: stats.clean, icon: "bx-shield-check", color: "text-safe" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-canvas border border-outline rounded-2xl px-5 py-4 shadow-sm">
            <i className={`bx ${icon} text-2xl ${color}`} />
            <p className="text-2xl font-bold text-ink mt-1">{value}</p>
            <p className="text-xs text-ink-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm text-ink-muted font-medium">Filter:</span>
        <FilterPills
          options={["all", "phishing", "suspicious", "clean"]}
          value={verdictFilter}
          onChange={(v) => { setVerdictFilter(v as Verdict | "all"); setPage(1); }}
        />
        <FilterPills
          options={["all", "url", "email"]}
          value={typeFilter}
          onChange={(v) => { setTypeFilter(v as ScanType | "all"); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="bg-canvas border border-outline rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline bg-subtle text-ink-muted text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left w-8">Type</th>
              <th className="px-4 py-3 text-left">Input</th>
              <th className="px-4 py-3 text-left w-20">Score</th>
              <th className="px-4 py-3 text-left w-28">Verdict</th>
              <th className="px-4 py-3 text-left w-28">Time</th>
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {paginated.map((scan) => (
              <>
                <tr
                  key={scan.id}
                  onClick={() => setExpanded(expanded === scan.id ? null : scan.id)}
                  className="border-b border-outline hover:bg-subtle transition cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <i className={`bx ${scan.scan_type === "url" ? "bx-link text-brand-400" : "bx-envelope text-ink-muted"} text-lg`} />
                  </td>
                  <td className="px-4 py-3 text-ink font-mono max-w-xs truncate">
                    {scan.input_value.length > 60 ? scan.input_value.slice(0, 60) + "…" : scan.input_value}
                  </td>
                  <td className={`px-4 py-3 ${scoreColor(scan.risk_score)}`}>{scan.risk_score}</td>
                  <td className="px-4 py-3"><VerdictBadge verdict={scan.verdict} size="sm" /></td>
                  <td className="px-4 py-3 text-ink-muted">{relativeTime(scan.timestamp)}</td>
                  <td className="px-4 py-3">
                    <i className={`bx ${expanded === scan.id ? "bx-chevron-up" : "bx-chevron-down"} text-ink-muted`} />
                  </td>
                </tr>
                {expanded === scan.id && (
                  <tr key={`${scan.id}-expanded`} className="bg-subtle border-b border-outline">
                    <td colSpan={6} className="px-6 py-4 space-y-3">
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Layer Breakdown</p>
                      <LayerBreakdown layers={scan.layers} />
                      <div className="pt-1">
                        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Top Reasons</p>
                        <ul className="space-y-1">
                          {scan.reasons.map((r, i) => (
                            <li key={i} className="text-sm text-ink-muted flex items-start gap-2">
                              <i className="bx bx-right-arrow-alt text-brand-400 mt-0.5 shrink-0" />{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline">
            <span className="text-xs text-ink-muted">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-1">
              <PageBtn onClick={() => setPage(page - 1)} disabled={page === 1} icon="bx-chevron-left" />
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition cursor-pointer ${page === i + 1 ? "bg-brand-500 text-white" : "text-ink-muted hover:bg-subtle"}`}
                >
                  {i + 1}
                </button>
              ))}
              <PageBtn onClick={() => setPage(page + 1)} disabled={page === totalPages} icon="bx-chevron-right" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPills({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 bg-subtle border border-outline rounded-xl p-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${value === opt ? "bg-brand-500 text-white shadow-sm" : "text-ink-muted hover:text-ink"}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function PageBtn({ onClick, disabled, icon }: { onClick: () => void; disabled: boolean; icon: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-subtle disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
    >
      <i className={`bx ${icon}`} />
    </button>
  );
}
