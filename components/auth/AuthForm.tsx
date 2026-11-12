"use client";

import { FormEvent, useState } from "react";

const examOptions = ["UGC NET", "SSC", "UPSC", "Banking", "Railways"];

type AuthFormProps = { mode: "login" | "signup" };

export default function AuthForm({ mode }: AuthFormProps) {
  const isSignup = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [selectedExams, setSelectedExams] = useState<string[]>(["UGC NET"]);
  const [notice, setNotice] = useState("");

  function toggleExam(exam: string) {
    setSelectedExams((current) =>
      current.includes(exam)
        ? current.filter((item) => item !== exam)
        : [...current, exam]
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(
      "Your details are ready. Account creation and login will be activated after the secure Supabase connection is configured."
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-aside">
          <a className="brand auth-brand" href="/">
            <span className="brand-mark">M</span>MockMaster
          </a>
          <div className="auth-aside-copy">
            <span className="auth-kicker">YOUR PREPARATION, YOUR PACE</span>
            <h1>Small steps.<br /><span>Big achievements.</span></h1>
            <p>A focused space to practise, track your progress and move closer to your exam goals.</p>
            <div className="auth-benefits">
              <div><span>✓</span> Organised exam practice</div>
              <div><span>✓</span> Track your learning journey</div>
              <div><span>✓</span> Practise from your phone or desktop</div>
            </div>
          </div>
          <p className="auth-aside-foot">Practice. Improve. Achieve.</p>
        </div>

        <div className="auth-form-side">
          <div className="auth-mobile-brand">
            <a className="brand" href="/"><span className="brand-mark">M</span>MockMaster</a>
          </div>
          <div className="auth-form-wrap">
            <a className="auth-back" href="/">← Back to homepage</a>
            <span className="auth-kicker">{isSignup ? "GET STARTED" : "WELCOME BACK"}</span>
            <h2>{isSignup ? "Create your account" : "Log in to MockMaster"}</h2>
            <p className="auth-intro">
              {isSignup
                ? "Set up your account and choose the exams you are preparing for."
                : "Enter your registered mobile number and password to continue."}
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              {isSignup && (
                <label className="auth-field">
                  <span>Full name</span>
                  <input name="fullName" type="text" placeholder="Enter your full name" autoComplete="name" required minLength={2} />
                </label>
              )}

              <label className="auth-field">
                <span>Mobile number</span>
                <div className="phone-input">
                  <span className="country-code">+91</span>
                  <input name="mobile" type="tel" inputMode="numeric" placeholder="10-digit mobile number" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} minLength={10} required />
                </div>
              </label>

              <label className="auth-field">
                <span>Password</span>
                <div className="password-input">
                  <input name="password" type={showPassword ? "text" : "password"} placeholder={isSignup ? "Create a strong password" : "Enter your password"} autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} required />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {isSignup && <small>Use at least 8 characters.</small>}
              </label>

              {isSignup && (
                <fieldset className="exam-picker">
                  <legend>Which exams are you preparing for?</legend>
                  <p>You can select more than one.</p>
                  <div className="exam-choice-grid">
                    {examOptions.map((exam) => (
                      <label className={selectedExams.includes(exam) ? "exam-choice selected" : "exam-choice"} key={exam}>
                        <input type="checkbox" checked={selectedExams.includes(exam)} onChange={() => toggleExam(exam)} />
                        <span className="choice-check">{selectedExams.includes(exam) ? "✓" : ""}</span>
                        {exam}
                      </label>
                    ))}
                  </div>
                  {selectedExams.length === 0 && <small className="field-error">Select at least one examination.</small>}
                </fieldset>
              )}

              {!isSignup && <div className="auth-inline-row"><label className="remember-option"><input type="checkbox" /> Remember me</label><a href="/forgot-password">Forgot password?</a></div>}

              {notice && <div className="auth-notice" role="status">{notice}</div>}

              <button className="btn btn-primary auth-submit" type="submit" disabled={isSignup && selectedExams.length === 0}>
                {isSignup ? "Create account" : "Log in"} <span>→</span>
              </button>
            </form>

            <p className="auth-switch">
              {isSignup ? "Already have an account?" : "New to MockMaster?"}{" "}
              <a href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create an account"}</a>
            </p>
            <p className="auth-legal">By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
