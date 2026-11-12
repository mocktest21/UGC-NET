"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setMessage("If an account exists for this email, a password reset link has been sent. Please check your inbox.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-form-side auth-form-side-full">
          <div className="auth-form-wrap">
            <Link className="auth-back" href="/login">← Back to login</Link>
            <span className="auth-kicker">ACCOUNT SUPPORT</span>
            <h2>Reset your password</h2>
            <p className="auth-intro">Enter your registered email address and we will send you a password reset link.</p>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span>Email address</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required />
              </label>
              {error && <div className="auth-notice" role="alert">{error}</div>}
              {message && <div className="auth-notice" role="status">{message}</div>}
              <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>{loading ? "Sending..." : "Send reset link"} →</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
