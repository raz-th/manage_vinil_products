'use client';
import React, { useState } from 'react';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
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
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/");
        } catch (error) {
            switch (error.code) {
                case "auth/invalid-credential":
                    setError("Email sau parolă incorectă.");
                    break;
                case "auth/user-not-found":
                    setError("Nu există un cont cu acest email.");
                    break;
                case "auth/wrong-password":
                    setError("Parolă incorectă.");
                    break;
                case "auth/too-many-requests":
                    setError("Prea multe încercări. Încearcă din nou mai târziu.");
                    break;
                case "auth/user-disabled":
                    setError("Acest cont a fost dezactivat.");
                    break;
                default:
                    setError("A apărut o eroare. Încearcă din nou.");
            }
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