
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