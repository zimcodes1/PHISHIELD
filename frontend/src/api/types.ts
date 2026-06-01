
export type User = {
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