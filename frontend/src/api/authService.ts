import axios from "axios"
import type { User, LoginResponse, UserStats } from "./types"
const API_URL = 'http://localhost:8000/api/v1'

export const loginUser = async function (email: string, password: string) {
    try {
        const formData = new URLSearchParams()
        formData.append('username', email)
        formData.append('password', password)
        const response = await axios.post<LoginResponse>(
            `${API_URL}/auth/login`,
            formData
        )
        return response.data
    }
    catch (err) {
        throw err
    }
}

export const signUpUser = async function (fullname: string, email: string, password: string) {
    const response = await axios.post<User>(
        `${API_URL}/auth/register`,
        { fullname, email, password }
    )
    return response.data
}

export const getUserProfile = async function (access_token: string) {
    try {
        const response = await axios.get<User>(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        })
        return response.data
    } catch(err) {
        throw err
    }
}

export const updatePassword = async function (old_password: string, new_password: string, access_token: string) {
    const response = await axios.post(
        `${API_URL}/auth/update-password`,
        { old_password, new_password },
        { headers: { 'Authorization': `Bearer ${access_token}` } }
    )
    return response.data
}

export const getUserStats = async function (access_token: string) {
    const response = await axios.get<UserStats>(`${API_URL}/history/stats`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
    })
    return response.data
}