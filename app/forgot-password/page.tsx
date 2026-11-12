import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page"><section className="auth-shell"><div className="auth-form-side auth-form-side-full"><div className="auth-form-wrap"><a className="auth-back" href="/login">← Back to login</a><span className="auth-kicker">ACCOUNT SUPPORT</span><h2>Reset your password</h2><p className="auth-intro">Password reset will be available after the secure account service is connected. Please return to login for now.</p><Link className="btn btn-primary auth-submit" href="/login">Back to login →</Link></div></div></section></main>
  );
}
