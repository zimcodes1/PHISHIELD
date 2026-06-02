
export type User = {
    id: string;
    fullname: string;
    email: string;
    created_at: string;
}

export type LoginResponse = {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

export type UserStats = {
    total: number;
    safe: number;
    suspicious: number;
    phishing: number;
}

export type LayerResult = {
    name: string;
    score: number;
    reasons: string[];
    weight: number;
    sub_checks?: LayerResult[];
}

export type AnalysisResponse = {
    scan_id: string;
    risk_score: number;
    verdict: "Clean" | "Suspicious" | "Phishing";
    top_reasons: string[];
    layers_list: LayerResult[];
    timestamp: string;
}

export type ScanHistoryItem = {
    id: string;
    scan_type: "url" | "email_text" | "email_file" | "extension_url";
    input_value: string;
    risk_score: number;
    verdict: "Clean" | "Suspicious" | "Phishing";
    top_reasons: string[];
    layers_list?: LayerResult[] | null;
    timestamp: string;
}

export type HistoryResponse = {
    page: number;
    page_size: number;
    total_scans: number;
    scans: ScanHistoryItem[];
}
