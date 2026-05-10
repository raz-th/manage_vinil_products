'use client';
import React, { useState } from 'react';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import './Login.css';
import { FcGoogle } from 'react-icons/fc';
import { useRouter } from 'next/navigation';
// import { collection, doc, getDoc } from 'firebase/firestore';


const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();

        try {

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

          
            router.push("/")

        } catch (error) {
            console.error(error);
        }
    };

    const handleGoogleLogin = async () => {

        try {

            await signInWithPopup(
                auth,
                googleProvider
            );

           router.push("/")

        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="login-container">
            <div className="login-form">
                <h2>Login</h2>
                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label>Email</label>
                        <input type="email" onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input type="password" onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <button type="submit" className="login-button">Sign In</button>
                </form>

                <div className="separator">OR</div>

                <button onClick={handleGoogleLogin} className="google-btn">
                    <FcGoogle /> Google
                </button>
            </div>
        </div>
    );
};

export default Login;