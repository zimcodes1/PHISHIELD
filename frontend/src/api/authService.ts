import axios from "axios"
import type { User, LoginResponse, UserStats, AnalysisResponse, HistoryResponse } from "./types"
const API_URL = 'https://phishield-backend.vercel.app/api/v1'

// ── Axios instance ────────────────────────────────────────────────────────────
// All API calls use this instance so the interceptor applies everywhere.
export const apiClient = axios.create({ baseURL: API_URL })

let _isRefreshing = false
let _pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

const flushQueue = (token: string | null, error: unknown = null) => {
    _pendingQueue.forEach(({ resolve, reject }) =>
        token ? resolve(token) : reject(error)
    )
    _pendingQueue = []
}

// Response interceptor — silently refresh on 401 and retry once
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config
        if (error.response?.status !== 401 || original._retry) {
            return Promise.reject(error)
        }
        original._retry = true

        if (_isRefreshing) {
            // Queue the request until the ongoing refresh resolves
            return new Promise((resolve, reject) => {
                _pendingQueue.push({ resolve, reject })
            }).then((token) => {
                original.headers['Authorization'] = `Bearer ${token}`
                return apiClient(original)
            })
        }

        _isRefreshing = true
        const storedRefreshToken = localStorage.getItem('refresh_token')

        if (!storedRefreshToken) {
            _isRefreshing = false
            return Promise.reject(error)
        }

        try {
            const { data } = await axios.post<LoginResponse>(
                `${API_URL}/auth/refresh`,
                { refresh_token: storedRefreshToken }
            )
            localStorage.setItem('access_token', data.access_token)
            localStorage.setItem('refresh_token', data.refresh_token)
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
            flushQueue(data.access_token)
            original.headers['Authorization'] = `Bearer ${data.access_token}`
            return apiClient(original)
        } catch (refreshError) {
            flushQueue(null, refreshError)
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            localStorage.removeItem('user')
            window.location.href = '/login'
            return Promise.reject(refreshError)
        } finally {
            _isRefreshing = false
        }
    }
)

export const loginUser = async function (email: string, password: string) {
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)
    const response = await axios.post<LoginResponse>(
        `${API_URL}/auth/login`,
        formData
    )
    return response.data
}

export const signUpUser = async function (fullname: string, email: string, password: string) {
    const response = await axios.post<User>(
        `${API_URL}/auth/register`,
        { fullname, email, password }
    )
    return response.data
}

export const getUserProfile = async function (access_token: string) {
    const response = await apiClient.get<User>(`/auth/me`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
    })
    return response.data
}

export const updatePassword = async function (old_password: string, new_password: string, access_token: string) {
    const response = await apiClient.post(
        `/auth/update-password`,
        { old_password, new_password },
        { headers: { 'Authorization': `Bearer ${access_token}` } }
    )
    return response.data
}

export const getAnalysisHistory = async function (access_token: string, page = 1, page_size = 100) {
    const response = await apiClient.get<HistoryResponse>(`/analyze/history`, {
        params: { page, page_size },
        headers: { 'Authorization': `Bearer ${access_token}` }
    })
    return response.data
}

export const getAllAnalysisHistory = async function (access_token: string) {
    const scans: HistoryResponse["scans"] = []
    let page = 1
    let total = 0

    do {
        const response = await getAnalysisHistory(access_token, page, 100)
        scans.push(...response.scans)
        total = response.total_scans
        page += 1
    } while (scans.length < total)

    return scans
}

export const getUserStats = async function (access_token: string): Promise<UserStats> {
    const scans = await getAllAnalysisHistory(access_token)
    return {
        total: scans.length,
        safe: scans.filter((scan) => scan.verdict === "Clean").length,
        suspicious: scans.filter((scan) => scan.verdict === "Suspicious").length,
        phishing: scans.filter((scan) => scan.verdict === "Phishing").length,
    }
}

export const analyzeURL = async function (url: string, access_token: string) {
    const response = await apiClient.post<AnalysisResponse>(
        `/analyze/url`,
        { url },
        { headers: { 'Authorization': `Bearer ${access_token}` } }
    )
    return response.data
}

export const analyzeEmail = async function (
    subject: string,
    body: string,
    sender: string,
    raw_headers: string | undefined,
    access_token: string
) {
    const response = await apiClient.post<AnalysisResponse>(
        `/analyze/email`,
        { subject, body, sender, raw_headers: raw_headers || null },
        { headers: { 'Authorization': `Bearer ${access_token}` } }
    )
    return response.data
}

export const analyzeEML = async function (file: File, access_token: string) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<AnalysisResponse>(
        `/analyze/email/upload`,
        formData,
        { headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'multipart/form-data' } }
    )
    return response.data
}
