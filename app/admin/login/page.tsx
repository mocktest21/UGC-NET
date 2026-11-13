"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user?.app_metadata?.role === "admin") {
        router.replace("/admin");
        return;
      }
      setChecking(false);
    })();
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;
      if (data.user?.app_metadata?.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("This account does not have administrator access. Use an authorised admin account.");
      }
      window.location.assign("/admin");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in. Please try again.");
      setLoading(false);
    }
  }

  if (checking) return <main className="auth-page"><section className="auth-shell"><div className="auth-form-side auth-form-side-full"><div className="auth-form-wrap">Checking administrator session…</div></div></section></main>;

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-aside">
          <a className="brand auth-brand" href="/"><span className="brand-mark">M</span>MockMaster</a>
          <div className="auth-aside-copy">
            <span className="auth-kicker">RESTRICTED ACCESS</span>
            <h1>Administrator<br /><span>control centre.</span></h1>
            <p>Sign in with your authorised administrator account to manage questions, imports and platform operations.</p>
            <div className="auth-benefits">
              <div><span>✓</span> Protected admin workspace</div>
              <div><span>✓</span> Question bank and review controls</div>
              <div><span>✓</span> Separate from student sign-in</div>
            </div>
          </div>
          <p className="auth-aside-foot">MockMaster Administration</p>
        </div>
        <div className="auth-form-side">
          <div className="auth-form-wrap">
            <a className="auth-back" href="/">← Back to homepage</a>
            <span className="auth-kicker">ADMINISTRATOR SIGN IN</span>
            <h2>Admin login</h2>
            <p className="auth-intro">This login is only for authorised MockMaster administrators. Student accounts cannot enter the admin workspace.</p>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span>Admin email address</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" autoComplete="username" required />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <div className="password-input">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter admin password" autoComplete="current-password" required />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button>
                </div>
              </label>
              {error && <div className="auth-notice" role="alert">{error}</div>}
              <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
                {loading ? "Verifying access…" : "Sign in to admin"} <span>→</span>
              </button>
            </form>
            <p className="auth-switch"><a href="/login">Student login</a></p>
            <p className="auth-legal">Access is granted only to accounts with the administrator role.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
