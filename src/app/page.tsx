"use client";

import React, { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, AlertCircle, CheckCircle, Sun, Moon } from "lucide-react";
import styles from "./page.module.css";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [emailPrefix, setEmailPrefix] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Initialize theme from document element
  useEffect(() => {
    const isLight = document.documentElement.classList.contains('light-theme');
    const timer = setTimeout(() => {
      setTheme(isLight ? 'light' : 'dark');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.remove('dark-theme', 'light-theme');
    document.documentElement.classList.add(nextTheme + '-theme');
  };

  // Redirect users if already logged in
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      if (session.user.role === "ADMIN") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [status, session, router]);

  // Clean errors and messages on toggle
  const toggleView = () => {
    setIsLogin(!isLogin);
    setError(null);
    setSuccessMsg(null);
    setUsername("");
    setPassword("");
    setEmailPrefix("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        // Redirection handled by useEffect
        router.refresh();
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !emailPrefix) {
      setError("Please fill in all registration fields.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, emailPrefix }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to register.");
      } else {
        setSuccessMsg(data.message || "Registration successful! Pending admin approval.");
        setIsLogin(true);
        // Autofill username for quick login once approved
        setUsername(username);
        setPassword("");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("An error occurred during registration. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className={styles.container}>
        <div className={styles.spinner} style={{ width: "32px", height: "32px" }}></div>
      </div>
    );
  }

  // Render form if not logged in
  return (
    <main className={styles.container}>
      <button onClick={toggleTheme} className={styles.themeToggle} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Mail size={22} strokeWidth={2.5} />
          </div>
          <h1 className={styles.title}>metainfosci</h1>
          <p className={styles.subtitle}>
            {isLogin
              ? "Sign in to manage your domain inbox"
              : "Register a custom @metainfosci.com address"}
          </p>
        </div>

        {error && (
          <div className={`${styles.alert} ${styles.alertError}`}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className={`${styles.alert} ${styles.alertSuccess}`}>
            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>{successMsg}</span>
          </div>
        )}

        {isLogin ? (
          <form onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label htmlFor="login-username" className={styles.label}>Username</label>
              <div className={styles.inputWrapper}>
                <input
                  id="login-username"
                  type="text"
                  className={styles.input}
                  placeholder="admin or username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="login-password" className={styles.label}>Password</label>
              <div className={styles.inputWrapper}>
                <input
                  id="login-password"
                  type="password"
                  className={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <div className={styles.spinner}></div> : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className={styles.formGroup}>
              <label htmlFor="register-username" className={styles.label}>Account Username</label>
              <div className={styles.inputWrapper}>
                <input
                  id="register-username"
                  type="text"
                  className={styles.input}
                  placeholder="Choose login username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="register-email" className={styles.label}>Desired Email Address</label>
              <div className={styles.emailInputGroup}>
                <input
                  id="register-email"
                  type="text"
                  className={styles.emailInput}
                  placeholder="john.doe"
                  value={emailPrefix}
                  onChange={(e) => setEmailPrefix(e.target.value)}
                  disabled={loading}
                />
                <span className={styles.emailDomain}>@metainfosci.com</span>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="register-password" className={styles.label}>Password</label>
              <div className={styles.inputWrapper}>
                <input
                  id="register-password"
                  type="password"
                  className={styles.input}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <div className={styles.spinner}></div> : "Request Registration"}
            </button>
          </form>
        )}

        <div className={styles.footer}>
          {isLogin ? (
            <>
              Need a domain address?{" "}
              <span className={styles.link} onClick={toggleView}>
                Request registration
              </span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <span className={styles.link} onClick={toggleView}>
                Sign in
              </span>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
