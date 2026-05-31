import React, { createContext, useEffect, useState } from "react";
import type { User } from "../api/types";
import { useNavigate } from "react-router-dom";
import { getUserProfile, loginUser, signUpUser } from "../api/authService";

type UserContextType = {
    user: User | null;
    access_token: string | null;
    register: (email:string, fullname:string, password:string) => void;
    login: (email:string, password:string) => void;
    logout: ()=>void;
    getUser: (access_token:string) => void;
}

type Props = {children: React.ReactNode};

const UserContext =  createContext<UserContextType>({} as UserContextType)

export const UserProvider = ({children}:Props)=>{
    const navigate = useNavigate()
    const [access_token, setAccessToken] = useState<string | null>(null)
    const [user, setUser] = useState<User | null>(null)

    useEffect(()=>{
        const user = localStorage.getItem('user')
        const access_token = localStorage.getItem('access_token')
        if (user && access_token){
            setAccessToken(access_token)
            setUser(JSON.parse(user))
        }
    }, [])
    
    const register = async (email:string, fullname:string, password:string)=>{
        await signUpUser(email=email, fullname=fullname, password=password).then((res)=>{
            if (res) {
                navigate('/login')
            }
        }).catch((err)=>{
            console.log(err)
        })
    }

    const login = async (email:string, password:string)=>{
        await loginUser(email=email, password=password).then((res)=>{
            if (res) {
                localStorage.setItem('access_token', res.access_token)
                setAccessToken(res.access_token)
                navigate('/')
            }
        }).catch((err)=>{
            console.log(err)
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
        <UserContext.Provider value={{ login, logout, register, getUser, user, access_token }}>
            {children}
        </UserContext.Provider>
    )
}

export const useAuth = () => {
    return React.useContext(UserContext);
}