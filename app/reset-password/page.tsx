"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
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
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Your password has been updated. You can now log in with your new password.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reset link may have expired. Request a new one and try again.");
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
            <h2>Choose a new password</h2>
            <p className="auth-intro">Enter a new password for your MockMaster account.</p>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span>New password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" required />
              </label>
              {error && <div className="auth-notice" role="alert">{error}</div>}
              {message && <div className="auth-notice" role="status">{message}</div>}
              <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>{loading ? "Updating..." : "Update password"} →</button>
              {message && <Link className="btn btn-outline auth-submit" href="/login">Go to login</Link>}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
