'use client';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import './Login.css';
import { FcGoogle } from 'react-icons/fc';
import { useRouter } from 'next/navigation';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
// import { collection, doc, getDoc } from 'firebase/firestore';


const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();
    const [error, setError] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();

        setError("");

        try {

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            router.push("/");

        } catch (error) {

            switch (error.message) {

                case "Invalid login credentials":
                    setError("Email sau parolă incorectă.");
                    break;

                case "Email not confirmed":
                    setError("Email-ul nu este confirmat.");
                    break;

                default:
                    setError("A apărut o eroare. Încearcă din nou.");
            }

            console.error(error);
        }
    };

    const handleGoogleLogin = async () => {

        try {

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) throw error;

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
                        <div className="password-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <span className="eye-icon" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </span>
                        </div>
                    </div>
                    {error && <p className="error-message">{error}</p>}
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