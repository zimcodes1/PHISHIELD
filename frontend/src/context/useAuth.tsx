/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useState } from "react";
import type { User } from "../api/types";
import { useNavigate } from "react-router-dom";
import { getUserProfile, loginUser, signUpUser } from "../api/authService";

type UserContextType = {
    user: User | null;
    access_token: string | null;
    auth_loading: boolean;
    register: (email:string, fullname:string, password:string) => void;
    login: (email:string, password:string) => void;
    logout: ()=>void;
    getUser: (access_token:string) => void;
}

type Props = {children: React.ReactNode};

const UserContext =  createContext<UserContextType>({} as UserContextType)

export const UserProvider = ({children}:Props)=>{
    const navigate = useNavigate()
    const [access_token, setAccessToken] = useState<string | null>(() => localStorage.getItem('access_token'))
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem('user')
        return storedUser ? JSON.parse(storedUser) as User : null
    })
    const [auth_loading, setAuthLoading] = useState(() => Boolean(localStorage.getItem('access_token')))

    useEffect(() => {
        const storedToken = localStorage.getItem('access_token')
        if (!storedToken) {
            return
        }

        getUserProfile(storedToken)
            .then((res) => {
                setUser(res)
                localStorage.setItem('user', JSON.stringify(res))
            })
            .catch(() => {
                localStorage.removeItem('access_token')
                localStorage.removeItem('user')
                setAccessToken(null)
                setUser(null)
                navigate('/login')
            })
            .finally(() => setAuthLoading(false))
    }, [navigate])
    
    const register = async (email: string, fullname: string, password: string) => {
        // signUpUser signature is (fullname, email, password) — map correctly
        await signUpUser(fullname, email, password).then((res) => {
            if (res) navigate('/login')
        }).catch((err) => {
            throw err
        })
    }

    const login = async (email:string, password:string)=>{
        await loginUser(email, password).then((res)=>{
            if (res) {
                localStorage.setItem('access_token', res.access_token)
                setAccessToken(res.access_token)
                navigate('/')
            }
        }).catch((err)=>{
            throw err
        })
    }

    const getUser = async (access_token:string)=>{
        await getUserProfile(access_token).then((res)=>{
            if(res){
                setUser(res)
                localStorage.setItem('user', JSON.stringify(res))
            }
        }).catch((err)=>{
            console.log(err)
        })
    } 

    const logout = ()=>{
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        setUser(null)
        setAccessToken(null)
        navigate('/login')
    }

    return(
        <UserContext.Provider value={{ login, logout, register, getUser, user, access_token, auth_loading }}>
            {children}
        </UserContext.Provider>
    )
}

export const useAuth = () => {
    return React.useContext(UserContext);
}
