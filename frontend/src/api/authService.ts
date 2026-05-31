import axios from "axios"
import type { User, LoginResponse } from "./types"
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
        let error = new Error(`Login Error: ${err}`)
        throw error
    }
}

export const signUpUser = async function (fullname: string, email: string, password: string) {
    try {
        const response = await axios.post<User>(
            `${API_URL}/auth/register`,
            {fullname:fullname, email:email, password:password}
        )
        return response.data
    }
    catch(err){
        let error = new Error(`Signup Error: ${err}`)
        throw error
    }
}

export const getUserProfile = async function (access_token:string) {
    try{
        const response = await axios.get<User>(`${API_URL}/auth/me`, {
            headers:{'Authorization': `Bearer ${access_token}`}
        })
        return response.data
    }catch(err){
        let error = new Error(`Couldn't get user profile: ${err}`)
        throw error
    }
}