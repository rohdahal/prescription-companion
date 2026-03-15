"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { syncDevSeedSession } from "../src/lib/api";
import { getSupabaseBrowserClientSafely } from "../src/lib/supabase-browser";

type Mode = "login" | "register";

export function AuthPanel() {
  const supabase = getSupabaseBrowserClientSafely();
  const [mode, setMode] = useState<Mode>("login");
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setError("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      setSession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError(null);

      if (nextSession?.access_token) {
        void syncDevSeedSession(nextSession.access_token).catch(() => {
          // Local dev convenience only.
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    void syncDevSeedSession(session.access_token).catch(() => {
      // Local dev convenience only.
    });
  }, [session?.access_token]);

  if (!supabase) {
    return (
      <section className="auth-card">
        <p className="eyebrow">Auth unavailable</p>
        <h2>Supabase browser auth is not configured for the web app.</h2>
        <p className="auth-copy">
          The UI expects <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          Restart <code>npm run dev:web</code> after fixing env loading.
        </p>
      </section>
    );
  }

  const authClient = supabase;

  async function handleEmailAuth() {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "login") {
        const { error: signInError } = await authClient.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          throw signInError;
        }

        setMessage("Signed in.");
        return;
      }

      const { error: signUpError } = await authClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (signUpError) {
        throw signUpError;
      }

      setMessage("Account created. Check your email if confirmation is enabled.");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  }

  async function handleGoogleAuth() {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const { error: oauthError } = await authClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (oauthFailure) {
      setError(oauthFailure instanceof Error ? oauthFailure.message : "Google sign-in failed");
      setPending(false);
    }
  }

  async function handleSignOut() {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const { error: signOutError } = await authClient.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }

      setMessage("Signed out.");
    } catch (signOutFailure) {
      setError(signOutFailure instanceof Error ? signOutFailure.message : "Sign-out failed");
    } finally {
      setPending(false);
    }
  }

  if (session) {
    return (
      <section className="auth-card">
        <p className="eyebrow">Authenticated</p>
        <h2>Welcome back</h2>
        <p className="auth-copy">
          Signed in as <strong>{session.user.email}</strong>. You can go straight to the dashboard, review a
          prescription, or test the assistant.
        </p>
        <div className="auth-actions">
          <Link className="primary-link" href="/dashboard">
            Open dashboard
          </Link>
          <button className="secondary-button" onClick={handleSignOut} disabled={pending}>
            {pending ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
        <button
          className={mode === "login" ? "auth-tab active" : "auth-tab"}
          onClick={() => setMode("login")}
          type="button"
        >
          Login
        </button>
        <button
          className={mode === "register" ? "auth-tab active" : "auth-tab"}
          onClick={() => setMode("register")}
          type="button"
        >
          Register
        </button>
      </div>

      <div className="auth-stack">
        <div>
          <p className="eyebrow">{mode === "login" ? "Secure access" : "Create account"}</p>
          <h2>{mode === "login" ? "Sign in to your medication workspace" : "Set up your patient workspace"}</h2>
        </div>

        <button className="google-button" onClick={handleGoogleAuth} type="button" disabled={pending}>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or use email</span>
        </div>

        {mode === "register" ? (
          <label className="field">
            <span>Full name</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Rohan Dahal" />
          </label>
        ) : null}

        <label className="field">
          <span>Email</span>
          <input
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
          />
        </label>

        <button className="primary-button" onClick={handleEmailAuth} type="button" disabled={pending}>
          {pending ? "Working..." : mode === "login" ? "Login" : "Create account"}
        </button>

        {message ? <p className="auth-message success">{message}</p> : null}
        {error ? <p className="auth-message error">{error}</p> : null}
      </div>
    </section>
  );
}
