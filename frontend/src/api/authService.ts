import axios from "axios"
import type { User, LoginResponse, UserStats, AnalysisResponse, HistoryResponse } from "./types"
const API_URL = 'http://localhost:8000/api/v1'

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
    const response = await axios.get<User>(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
    })
    return response.data
}

export const updatePassword = async function (old_password: string, new_password: string, access_token: string) {
    const response = await axios.post(
        `${API_URL}/auth/update-password`,
        { old_password, new_password },
        { headers: { 'Authorization': `Bearer ${access_token}` } }
    )
    return response.data
}

export const getAnalysisHistory = async function (access_token: string, page = 1, page_size = 100) {
    const response = await axios.get<HistoryResponse>(`${API_URL}/analyze/history`, {
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
    const response = await axios.post<AnalysisResponse>(
        `${API_URL}/analyze/url`,
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
    const response = await axios.post<AnalysisResponse>(
        `${API_URL}/analyze/email`,
        { subject, body, sender, raw_headers: raw_headers || null },
        { headers: { 'Authorization': `Bearer ${access_token}` } }
    )
    return response.data
}

export const analyzeEML = async function (file: File, access_token: string) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await axios.post<AnalysisResponse>(
        `${API_URL}/analyze/email/upload`,
        formData,
        { headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'multipart/form-data' } }
    )
    return response.data
}
