import { Fragment, useEffect, useState } from "react";
import axios from "axios";
import VerdictBadge from "../components/dashboard/VerdictBadge";
import LayerBreakdown from "../components/dashboard/LayerBreakdown";
import Preloader from "../components/Preloader";
import { Alert } from "../components/Toast";
import { getAnalysisHistory } from "../api/authService";
import type { ScanHistoryItem } from "../api/types";
import { useAuth } from "../context/useAuth";
import { waitForMinimumDuration } from "../utils/minimumDelay";
import ProfileLink from "../components/dashboard/ProfileLink";

type Verdict = "clean" | "suspicious" | "phishing";
type ScanType = "url" | "email";

const PAGE_SIZE = 8;

const normaliseVerdict = (verdict: ScanHistoryItem["verdict"]): Verdict =>
  verdict.toLowerCase() as Verdict;

const displayScanType = (scanType: ScanHistoryItem["scan_type"]): ScanType =>
  scanType === "url" || scanType === "extension_url" ? "url" : "email";

const relativeTime = (iso: string) => {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function HistoryPage() {
  const { access_token } = useAuth();
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ScanType | "all">("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    document.title = "PhishShield | History";
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadHistory = async () => {
      if (!access_token) {
        setLoading(false);
        return;
      }

      const startedAt = Date.now();
      setLoading(true);
      setError(null);
      try {
        const allScans: ScanHistoryItem[] = [];
        let currentPage = 1;
        let totalScans = 0;

        do {
          const response = await getAnalysisHistory(access_token, currentPage, 100);
          allScans.push(...response.scans);
          totalScans = response.total_scans;
          currentPage += 1;
        } while (allScans.length < totalScans);

        if (!ignore) {
          setScans(allScans);
          setPage(1);
        }
      } catch (err) {
        if (!ignore) {
          const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
          setError(typeof detail === "string" ? detail : "Could not load scan history.");
        }
      } finally {
        await waitForMinimumDuration(startedAt);
        if (!ignore) setLoading(false);
      }
    };

    loadHistory();
    return () => {
      ignore = true;
    };
  }, [access_token]);

  const filtered = scans.filter((scan) => {
    const verdict = normaliseVerdict(scan.verdict);
    const scanType = displayScanType(scan.scan_type);
    return (
      (verdictFilter === "all" || verdict === verdictFilter) &&
      (typeFilter === "all" || scanType === typeFilter)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: scans.length,
    phishing: scans.filter((scan) => normaliseVerdict(scan.verdict) === "phishing").length,
    suspicious: scans.filter((scan) => normaliseVerdict(scan.verdict) === "suspicious").length,
    clean: scans.filter((scan) => normaliseVerdict(scan.verdict) === "clean").length,
  };

  const scoreColor = (score: number) =>
    score >= 70 ? "text-danger font-semibold" : score >= 40 ? "text-caution font-semibold" : "text-safe font-semibold";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-start justify-between gap-4 max-sm:relative">
        <div>
          <h1 className="text-2xl font-bold text-ink">Scan History</h1>
          <p className="text-ink-muted text-sm mt-1">All your past analyses, most recent first.</p>
        </div>
        <ProfileLink />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Scans", value: stats.total, icon: "bx-scan", color: "text-brand-500", accent: 'blue-500' },
          { label: "Phishing Blocked", value: stats.phishing, icon: "bx-shield-x", color: "text-danger", accent: 'red-600'  },
          { label: "Suspicious", value: stats.suspicious, icon: "bx-error", color: "text-caution", accent: 'orange-600'  },
          { label: "Clean", value: stats.clean, icon: "bx-check-shield", color: "text-safe", accent: 'green-500'  },
        ].map(({ label, value, icon, color, accent }) => (
          <div key={label} className={` bg-${accent}/30 backdrop-blur-xs rounded-2xl px-5 py-4 shadow-sm`}>
            <i className={`bx ${icon} text-2xl ${color}`} />
            <p className="text-2xl font-bold text-ink mt-1">{value}</p>
            <p className="text-xs text-ink-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm text-ink-muted font-medium">Filter:</span>
        <FilterPills
          options={["all", "phishing", "suspicious", "clean"]}
          value={verdictFilter}
          onChange={(value) => { setVerdictFilter(value as Verdict | "all"); setPage(1); }}
        />
        <FilterPills
          options={["all", "url", "email"]}
          value={typeFilter}
          onChange={(value) => { setTypeFilter(value as ScanType | "all"); setPage(1); }}
        />
      </div>

      {error && <Alert variant="error" message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <div className="glass-card rounded-2xl shadow-sm">
          <Preloader message="Loading scan history..." />
        </div>
      ) : (
        <div className="glass-card rounded-2xl shadow-sm overflow-hidden max-sm:overflow-scroll max-sm:mb-10">
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
              {paginated.map((scan) => {
                const scanType = displayScanType(scan.scan_type);
                const verdict = normaliseVerdict(scan.verdict);
                const layers = scan.layers_list ?? [];

                return (
                  <Fragment key={scan.id}>
                    <tr
                      onClick={() => setExpanded(expanded === scan.id ? null : scan.id)}
                      className="border-b border-outline hover:bg-subtle transition cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <i className={`bx ${scanType === "url" ? "bx-link text-brand-400" : "bx-envelope text-ink-muted"} text-lg`} />
                      </td>
                      <td className="px-4 py-3 text-ink font-mono max-w-xs truncate">
                        {scan.input_value.length > 60 ? `${scan.input_value.slice(0, 60)}...` : scan.input_value}
                      </td>
                      <td className={`px-4 py-3 ${scoreColor(scan.risk_score)}`}>{scan.risk_score}</td>
                      <td className="px-4 py-3"><VerdictBadge verdict={verdict} size="sm" /></td>
                      <td className="px-4 py-3 text-ink-muted">{relativeTime(scan.timestamp)}</td>
                      <td className="px-4 py-3">
                        <i className={`bx ${expanded === scan.id ? "bx-chevron-up" : "bx-chevron-down"} text-ink-muted`} />
                      </td>
                    </tr>
                    {expanded === scan.id && (
                      <tr className="bg-subtle border-b border-outline">
                        <td colSpan={6} className="px-6 py-4 space-y-3">
                          {layers.length > 0 && (
                            <>
                              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Layer Breakdown</p>
                              <LayerBreakdown layers={layers} />
                            </>
                          )}
                          <div className="pt-1">
                            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Top Reasons</p>
                            {scan.top_reasons.length > 0 ? (
                              <ul className="space-y-1">
                                {scan.top_reasons.map((reason) => (
                                  <li key={reason} className="text-sm text-ink-muted flex items-start gap-2">
                                    <i className="bx bx-right-arrow-alt text-brand-400 mt-0.5 shrink-0" />{reason}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-ink-muted">No top reasons were recorded for this scan.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-ink-muted">
                    No scans match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-outline">
              <span className="text-xs text-ink-muted">
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
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
      )}
    </div>
  );
}

function FilterPills({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex gap-1 bg-subtle border border-outline rounded-xl p-1">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${value === option ? "bg-brand-500 text-white shadow-sm" : "text-ink-muted hover:text-ink"}`}
        >
          {option}
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
