"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type StudentProfile = {
  full_name?: string;
  exams?: string[];
  phone_number?: string | null;
};

type Student = {
  name: string;
  email: string;
  exams: string[];
  phone?: string | null;
};

const desktopNavigation = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Practice", href: "/practice" },
  { label: "Live Test", href: "/live-test" },
  { label: "Personal Notebook", href: "/personal-notebook" },
  { label: "About Us", href: "/About" },
];

const practiceOptions = [
  { title: "UGC NET Paper 1", detail: "Teaching & Research Aptitude", tag: "Common paper", icon: "📘" },
  { title: "Commerce", detail: "UGC NET Paper 2 · Subject code 08", tag: "Paper 2", icon: "📊" },
  { title: "Management", detail: "UGC NET Paper 2 · Subject code 17", tag: "Paper 2", icon: "💼" },
];

const summaryStats = [
  { label: "Tests attempted", icon: "▤", note: "Completed tests" },
  { label: "Average score", icon: "↗", note: "Across completed tests" },
  { label: "Accuracy", icon: "◎", note: "Correct answers ÷ attempted" },
  { label: "Units mastered", icon: "✓", note: "Based on unit performance" },
  { label: "Total questions", icon: "▦", note: "In your selected question banks" },
  { label: "Unique questions attempted", icon: "◉", note: "Distinct questions answered across completed tests" },
  { label: "Relative standing", icon: "🏆", note: "Your percentile among comparable students" },
  { label: "Average time per question", icon: "◷", note: "Average time spent on each attempted question" },
];

function EmptyAnalytics({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mm-analytics-empty">
      <span className="mm-empty-icon">▤</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [analytics,setAnalytics]=useState({attempts:[] as any[],responses:[] as any[],testQuestions:[] as any[],questions:[] as any[],tests:[] as any[],exams:[] as any[]});
  const [dateFilter,setDateFilter]=useState("all");
  const [customFrom,setCustomFrom]=useState("");
  const [customTo,setCustomTo]=useState("");
  const [reattemptingId,setReattemptingId]=useState("");
  const [actionError,setActionError]=useState("");

  useEffect(() => {
    let active = true;

    async function loadStudent() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          router.replace("/login");
          return;
        }

        if (!active) return;
        const profile = data.user.user_metadata as StudentProfile;
        setStudent({
          name: profile.full_name || "Student",
          email: data.user.email || "",
          exams: Array.isArray(profile.exams) ? profile.exams : [],
          phone: profile.phone_number,
        });

        const { data: attemptRows } = await supabase.from("test_attempts")
          .select("id,test_id,score,max_score,accuracy,questions_attempted,correct_count,incorrect_count,unanswered_count,status,started_at,submitted_at,time_taken_seconds")
          .eq("student_id", data.user.id)
          .in("status", ["submitted","auto_submitted"])
          .order("started_at", { ascending: false })
          .limit(500);
        const attempts = (attemptRows || []) as any[];
        const attemptIds = attempts.map((a) => a.id);
        const testIds = Array.from(new Set(attempts.map((a) => a.test_id).filter(Boolean)));

        let tests: any[] = [];
        let responses: any[] = [];
        let testQuestions: any[] = [];
        let questions: any[] = [];
        if (testIds.length) {
          const { data: testRows } = await supabase.from("tests")
            .select("id,title,exam_id,paper_id,subject_id")
            .in("id", testIds);
          tests = (testRows || []) as any[];
        }
        if (attemptIds.length) {
          const { data: responseRows } = await supabase.from("student_responses")
            .select("attempt_id,test_question_id,response,is_correct,time_spent_seconds")
            .in("attempt_id", attemptIds);
          responses = (responseRows || []) as any[];
          const tqIds = Array.from(new Set(responses.map((r) => r.test_question_id).filter(Boolean)));
          if (tqIds.length) {
            const { data: tqRows } = await supabase.from("test_questions")
              .select("id,question_id,test_id")
              .in("id", tqIds);
            testQuestions = (tqRows || []) as any[];
            const questionIds = Array.from(new Set(testQuestions.map((q) => q.question_id).filter(Boolean)));
            if (questionIds.length) {
              const { data: questionRows } = await supabase.from("questions")
                .select("id,subject_id,unit_id,subjects(name),units(name)")
                .in("id", questionIds);
              questions = (questionRows || []) as any[];
            }
          }
        }
        const { data: preferenceRows } = await supabase.from("student_exam_preferences")
          .select("exam_id,selected_subject_id")
          .eq("student_id", data.user.id);
        const examIds = Array.from(new Set((preferenceRows || []).map((row: any) => row.exam_id).filter(Boolean)));
        let examRows: any[] = [];
        if (examIds.length) {
          const { data: catalogueRows } = await supabase.from("exams")
            .select("id,name")
            .in("id", examIds);
          const examById = new Map((catalogueRows || []).map((exam: any) => [exam.id, exam]));
          examRows = (preferenceRows || []).map((row: any) => ({
            ...row,
            name: (examById.get(row.exam_id) as any)?.name || "Selected examination",
          }));
        }

        if (active) {
          setAnalytics({
            attempts,
            responses,
            testQuestions,
            questions,
            tests,
            exams: examRows,
          });
        }
      } catch {
        router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStudent();
    return () => { active = false; };
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleReattempt(attemptId: string) {
    setReattemptingId(attemptId);
    setActionError("");
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("student_reattempt_test", { p_attempt_id: attemptId });
    setReattemptingId("");
    if (error) {
      setActionError(error.message || "Unable to prepare this reattempt.");
      return;
    }
    const next = data as { test_id: string; attempt_id: string; duration_seconds: number };
    router.push("/practice/session?" + new URLSearchParams({
      test: next.test_id,
      attempt: next.attempt_id,
      minutes: String(Math.ceil(next.duration_seconds / 60)),
    }).toString());
  }

  const now = new Date();
  const cutoff = dateFilter === "week" ? new Date(now.getTime() - 7 * 86400000)
    : dateFilter === "month" ? new Date(now.getTime() - 30 * 86400000)
    : dateFilter === "3months" ? new Date(now.getTime() - 90 * 86400000) : null;
  const filteredAttempts = analytics.attempts.filter((attempt: any) => {
    const date = new Date(attempt.submitted_at || attempt.started_at);
    if (dateFilter === "custom") {
      if (customFrom && date < new Date(customFrom + "T00:00:00")) return false;
      if (customTo && date > new Date(customTo + "T23:59:59")) return false;
      return true;
    }
    return !cutoff || date >= cutoff;
  });
  const filteredAttemptIds = new Set(filteredAttempts.map((a: any) => a.id));
  const filteredResponses = analytics.responses.filter((r: any) => filteredAttemptIds.has(r.attempt_id));
  const testQuestionById = new Map(analytics.testQuestions.map((q: any) => [q.id, q]));
  const questionById = new Map(analytics.questions.map((q: any) => [q.id, q]));
  const testById = new Map(analytics.tests.map((t: any) => [t.id, t]));
  const hasAnswer = (value: any) => value !== null && value !== undefined && value !== "" && JSON.stringify(value) !== "null" && JSON.stringify(value) !== '""';
  const evaluatedResponses = filteredResponses.filter((r: any) => r.is_correct === true || r.is_correct === false);
  const correctCount = evaluatedResponses.filter((r: any) => r.is_correct === true).length;
  const incorrectCount = evaluatedResponses.length - correctCount;
  const accuracyPercent = evaluatedResponses.length ? correctCount / evaluatedResponses.length * 100 : 0;
  const uniqueQuestionIds = new Set(filteredResponses.filter((r: any) => hasAnswer(r.response)).map((r: any) => {
    const tq: any = testQuestionById.get(r.test_question_id);
    return tq?.question_id;
  }).filter(Boolean));
  const scoredAttempts = filteredAttempts.filter((a: any) => a.score !== null && Number(a.max_score) > 0);
  const averageScore = scoredAttempts.length ? scoredAttempts.reduce((sum: number, a: any) => sum + Number(a.score) / Number(a.max_score) * 100, 0) / scoredAttempts.length : null;
  const totalQuestions = filteredAttempts.reduce((sum: number, a: any) => sum + Number(a.questions_attempted || 0) + Number(a.unanswered_count || 0), 0);
  const timeRows = filteredResponses.filter((r: any) => hasAnswer(r.response));
  const averageTime = timeRows.length ? timeRows.reduce((sum: number, r: any) => sum + Number(r.time_spent_seconds || 0), 0) / timeRows.length : null;
  const formatDuration = (seconds: number | null) => seconds === null ? "—" : seconds < 60 ? Math.round(seconds) + " sec" : Math.floor(seconds / 60) + "m " + Math.round(seconds % 60) + "s";

  const buildBreakdown = (field: "subject_id" | "unit_id") => {
    const map = new Map<string, any>();
    for (const response of evaluatedResponses) {
      const tq: any = testQuestionById.get(response.test_question_id);
      const q: any = tq ? questionById.get(tq.question_id) : null;
      const id = q?.[field];
      if (!id) continue;
      const relation = field === "subject_id" ? q.subjects : q.units;
      const name = Array.isArray(relation) ? relation[0]?.name : relation?.name;
      const item = map.get(id) || { id, name: name || "Unlabelled", attempted: 0, correct: 0, incorrect: 0, time: 0 };
      item.attempted += 1;
      if (response.is_correct) item.correct += 1; else item.incorrect += 1;
      item.time += Number(response.time_spent_seconds || 0);
      map.set(id, item);
    }
    return Array.from(map.values()).map((item) => ({
      ...item,
      accuracy: item.attempted ? item.correct / item.attempted * 100 : 0,
      avgTime: item.attempted ? item.time / item.attempted : 0,
    })).sort((a, b) => b.attempted - a.attempted);
  };
  const subjectPerformance = buildBreakdown("subject_id");
  const unitPerformance = buildBreakdown("unit_id");

  const examStats = analytics.exams.map((preference: any) => {
    const examName = preference.name;
    const examAttempts = filteredAttempts.filter((a: any) => (testById.get(a.test_id) as any)?.exam_id === preference.exam_id);
    const examAttemptIds = new Set(examAttempts.map((a: any) => a.id));
    const examResponses = filteredResponses.filter((r: any) => examAttemptIds.has(r.attempt_id) && (r.is_correct === true || r.is_correct === false));
    const examCorrect = examResponses.filter((r: any) => r.is_correct === true).length;
    const scored = examAttempts.filter((a: any) => a.score !== null && Number(a.max_score) > 0);
    const average = scored.length ? scored.reduce((sum: number, a: any) => sum + Number(a.score) / Number(a.max_score) * 100, 0) / scored.length : null;
    return {
      id: preference.exam_id,
      name: examName || "Selected examination",
      tests: examAttempts.length,
      average,
      accuracy: examResponses.length ? examCorrect / examResponses.length * 100 : null,
    };
  });

  if (loading || !student) {
    return (
      <main className="mm-loading">
        <span className="mm-loading-mark">M</span>
        <p>Loading your MockMaster dashboard...</p>
      </main>
    );
  }

  const initials = student.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const firstNameRaw = student.name.trim().split(/\s+/)[0] || "Student";
  const firstName = firstNameRaw.charAt(0).toUpperCase() + firstNameRaw.slice(1).toLowerCase();

  const profileMenu = (
    <div className="mm-profile-menu-wrap" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setProfileOpen(false);
    }}>
      <button type="button" className="mm-profile-trigger" aria-haspopup="menu" aria-expanded={profileOpen} aria-label="Open account menu" onClick={() => setProfileOpen((open) => !open)}>
        <span className="mm-avatar">{initials || "S"}</span><span>{firstName}</span><span className="mm-profile-chevron" aria-hidden="true">⌄</span>
      </button>
      {profileOpen && (
        <div className="mm-profile-dropdown" role="menu">
          <div className="mm-profile-dropdown-heading"><strong>{student.name}</strong><span>{student.email}</span></div>
          <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); setProfileDialogOpen(true); }}><span aria-hidden="true">♙</span> View profile</button>
          <button type="button" role="menuitem" className="mm-profile-logout" disabled={signingOut} onClick={() => void handleSignOut()}><span aria-hidden="true">↪</span> {signingOut ? "Logging out..." : "Log out"}</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="mm-dashboard">
      <aside className={menuOpen ? "mm-sidebar mm-sidebar-open" : "mm-sidebar"}>
        <a className="mm-brand" href="/"><span className="mm-brand-mark">M</span><span>MockMaster</span></a>
        <div className="mm-mobile-main-label">MAIN MENU</div>
        <nav className="mm-mobile-main-nav" aria-label="Main navigation">
          {desktopNavigation.map((item, index) => (
            <a key={item.label} className={index === 0 ? "mm-nav-link mm-nav-active" : "mm-nav-link"} href={item.href} onClick={() => setMenuOpen(false)}>
              <span className="mm-nav-icon">{["⌂", "◎", "◷", "▤", "ⓘ"][index]}</span>{item.label}
            </a>
          ))}
        </nav>
        <nav className="mm-desktop-nav" aria-label="Main navigation">
          {desktopNavigation.map((item, index) => (
            <a key={item.label} className={index === 0 ? "mm-nav-link mm-nav-active" : "mm-nav-link"} href={item.href}>{item.label}</a>
          ))}
        </nav>
        <div className="mm-sidebar-profile">{profileMenu}</div>
        <div className="mm-sidebar-bottom">
          <div className="mm-mobile-account-menu">
            <div className="mm-mobile-account-heading">
              <span className="mm-avatar">{initials || "S"}</span>
              <span><strong>{student.name}</strong><small>{student.email}</small></span>
            </div>
            <button type="button" className="mm-mobile-account-action" onClick={() => { setMenuOpen(false); setProfileDialogOpen(true); }}>
              <span aria-hidden="true">♙</span> View Profile
            </button>
            <button type="button" className="mm-mobile-account-action mm-mobile-logout" disabled={signingOut} onClick={() => void handleSignOut()}>
              <span aria-hidden="true">↪</span> {signingOut ? "Logging out..." : "Log Out"}
            </button>
          </div>
          <div className="mm-help-card">
            <span className="mm-help-icon">✦</span>
            <strong>Keep your momentum</strong>
            <p>Consistent practice builds measurable progress.</p>
          </div>

        </div>
      </aside>

      {menuOpen && <button className="mm-sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <div className="mm-main">
        <header className="mm-topbar">
          <button className="mm-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>☰</button>
          <a className="mm-mobile-topbar-brand" href="/dashboard"><span className="mm-brand-mark">M</span><span>MockMaster</span></a>
          <div className="mm-topbar-right">{profileMenu}</div>
        </header>

        <main className="mm-content mm-analytics-content" id="overview">
          <section className="mm-analytics-heading">
            <div>
              <h1>Hey, {firstName}!</h1>
              <p>Let’s analyse your progress and see where you can improve.</p>
            </div>
          </section>

          <section className="mm-analytics-summary" aria-label="Overall performance statistics">
            {summaryStats.map((stat) => (
              <article className="mm-analytics-stat" key={stat.label}>
                <span className="mm-analytics-stat-icon">{stat.icon}</span>
                <div className="mm-analytics-stat-copy">
                  <span>{stat.label}</span>
                  {stat.label === "Accuracy" ? (
                    <>
                      <strong className="mm-accuracy-value">{evaluatedResponses.length ? accuracyPercent.toFixed(1) + "%" : "—"}</strong>
                      <div className="mm-accuracy-meter" aria-label={evaluatedResponses.length ? accuracyPercent.toFixed(1) + "% accuracy" : "No evaluated answers yet"}>
                        <div className="mm-accuracy-meter-track" style={{display:"flex",width:"100%",height:10,minHeight:10,overflow:"hidden",borderRadius:999,background:"#e5e7eb"}}>
                          <span style={{display:"block",height:"100%",width:accuracyPercent+"%",background:"#16a34a"}} />
                          <span style={{display:"block",height:"100%",width:(evaluatedResponses.length?100-accuracyPercent:0)+"%",background:"#ef4444"}} />
                        </div>
                        <small>{correctCount} correct · {incorrectCount} incorrect</small>
                      </div>
                    </>
                  ) : (
                    <strong>{stat.label==="Tests attempted"?filteredAttempts.length:stat.label==="Average score"?(averageScore===null?"—":averageScore.toFixed(1)+"%"):stat.label==="Total questions"?totalQuestions:stat.label==="Unique questions attempted"?uniqueQuestionIds.size:stat.label==="Average time per question"?formatDuration(averageTime):"—"}</strong>
                  )}
                  <small>{stat.note}</small>
                </div>
              </article>
            ))}
          </section>

          <section className="mm-analytics-panel mm-overall-panel" id="performance">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">PROGRESS TRACKER</span><h2>Performance trends</h2><p>Your scores, accuracy and attempt history for the selected period.</p></div>
              <select className="mm-analytics-filter-select" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filter tests by date">
                <option value="all">All time</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
                <option value="3months">Last 3 months</option>
                <option value="custom">Custom range</option>
              </select>
            </div>
            {dateFilter === "custom" && (
              <div className="mm-custom-date-filter">
                <label>From <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
                <label>To <input type="date" value={customTo} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} /></label>
              </div>
            )}
            {actionError && <p className="mm-dashboard-action-error" role="alert">{actionError}</p>}
            {filteredAttempts.length ? (
              <div className="mm-dashboard-recent-tests">
                {filteredAttempts.slice(0, 20).map((test: any) => {
                  const meta: any = testById.get(test.test_id);
                  const pct = Number(test.max_score) > 0 && test.score !== null ? Math.max(0, Math.min(100, Number(test.score) / Number(test.max_score) * 100)) : null;
                  const total = Number(test.correct_count || 0) + Number(test.incorrect_count || 0) + Number(test.unanswered_count || 0);
                  const green = total ? Number(test.correct_count || 0) / total * 100 : 0;
                  const red = total ? Number(test.incorrect_count || 0) / total * 100 : 0;
                  return (
                    <article className="mm-dashboard-test-card" key={test.id}>
                      <div className="mm-dashboard-test-heading">
                        <span>{meta?.title || "Mock test"}</span>
                        <b>{pct === null ? "Submitted" : pct.toFixed(1) + "% score"}</b>
                      </div>
                      <small>{test.score === null ? "Score pending" : Number(test.score).toFixed(2) + " / " + Number(test.max_score || 0).toFixed(2) + " marks"} · {test.correct_count || 0} correct · {test.incorrect_count || 0} incorrect · {test.unanswered_count || 0} unattempted · {new Date(test.submitted_at || test.started_at).toLocaleDateString("en-IN")}</small>
                      <div className="mm-test-trend-track" aria-label={green.toFixed(0) + "% correct and " + red.toFixed(0) + "% incorrect"} style={{display:"flex",width:"100%",height:9,minHeight:9,overflow:"hidden",borderRadius:999,background:"#e5e7eb"}}>
                        <span style={{display:"block",height:"100%",width:green+"%",background:"#16a34a"}} />
                        <span style={{display:"block",height:"100%",width:red+"%",background:"#ef4444"}} />
                      </div>
                      <div className="mm-dashboard-test-actions">
                        <button type="button" className="mm-dashboard-analysis-button" onClick={() => router.push("/practice/result?" + new URLSearchParams({attempt: test.id}).toString())}>View Analysis</button>
                        <button type="button" className="mm-dashboard-reattempt-button" disabled={reattemptingId === test.id} onClick={() => void handleReattempt(test.id)}>{reattemptingId === test.id ? "Preparing…" : "Reattempt"}</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyAnalytics title="No tests in this period" detail="Complete a test or choose a wider date range to see your performance trends." />
            )}
          </section>

          <section className="mm-analytics-panel" id="examinations">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">EXAM-WISE OVERVIEW</span><h2>My examinations</h2><p>Live performance calculated separately for each examination you selected.</p></div>
              <span className="mm-count-pill">{examStats.length} selected</span>
            </div>
            {examStats.length ? (
              <div className="mm-analytics-exam-grid">
                {examStats.map((exam: any) => (
                  <article className="mm-analytics-exam-card" key={exam.id}>
                    <div className="mm-analytics-exam-top"><span className="mm-analytics-exam-icon">▤</span><span className="mm-analytics-status">Selected</span></div>
                    <h3>{exam.name}</h3>
                    <div className="mm-analytics-exam-metrics">
                      <div><strong>{exam.tests}</strong><span>Tests</span></div>
                      <div><strong>{exam.average === null ? "—" : exam.average.toFixed(1) + "%"}</strong><span>Average score</span></div>
                      <div><strong>{exam.accuracy === null ? "—" : exam.accuracy.toFixed(1) + "%"}</strong><span>Accuracy</span></div>
                    </div>
                    <p>{exam.tests ? "Based on " + exam.tests + " completed test attempt(s) in this period." : "No completed tests for this examination in the selected period."}</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyAnalytics title="No examinations selected" detail="Your selected examinations will appear here after you complete onboarding or update your exam preferences." />
            )}
          </section>

          <section className="mm-analytics-two-col">
            <article className="mm-analytics-panel">
              <div className="mm-analytics-panel-heading">
                <div><span className="mm-section-kicker">PAPER-WISE ANALYSIS</span><h2>Performance by paper</h2><p>Compare scores and accuracy across papers.</p></div>
              </div>
              <EmptyAnalytics title="Paper-wise statistics are not available yet" detail="Your paper-level results will appear here after you attempt tests." />
            </article>
            <article className="mm-analytics-panel">
              <div className="mm-analytics-panel-heading">
                <div><span className="mm-section-kicker">SUBJECT-WISE ANALYSIS</span><h2>Subject performance</h2><p>See how you are performing in each subject.</p></div>
              </div>
              {subjectPerformance.length?<div className="mm-dashboard-breakdown">{subjectPerformance.map((item:any)=><div className="mm-dashboard-breakdown-row" key={item.id}><div><strong>{item.name}</strong><small>{item.attempted} evaluated questions · {item.correct} correct · {item.incorrect} incorrect</small><div className="mm-breakdown-color-track" aria-label={item.accuracy.toFixed(1)+"% correct"} style={{display:"flex",width:"100%",height:10,minHeight:10,marginTop:8,overflow:"hidden",borderRadius:999,background:"#e5e7eb"}}><span style={{display:"block",height:"100%",width:item.accuracy+"%",background:"#16a34a"}}/><span style={{display:"block",height:"100%",width:(100-item.accuracy)+"%",background:"#ef4444"}}/></div></div><b>{item.accuracy.toFixed(1)}%<small>accuracy</small></b></div>)}</div>:<EmptyAnalytics title="Subject analysis will appear here" detail="Complete and submit subject-wise practice tests to build your performance record." />}
            </article>
          </section>

          <section className="mm-analytics-panel mm-unit-panel" id="unit-analysis">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">DETAILED SYLLABUS ANALYSIS</span><h2>Unit-wise performance</h2><p>Identify strong units, weak units and your progress across the syllabus.</p></div>
              <span className="mm-unit-badge">Core analytics</span>
            </div>
            {unitPerformance.length?<div className="mm-dashboard-breakdown">{unitPerformance.map((item:any)=><div className="mm-dashboard-breakdown-row" key={item.id}><div><strong>{item.name}</strong><small>{item.attempted} evaluated questions · {item.correct} correct · {item.incorrect} incorrect</small><div className="mm-breakdown-color-track" aria-label={item.accuracy.toFixed(1)+"% correct"}><span className="mm-breakdown-correct" style={{width:item.accuracy+"%"}}/><span className="mm-breakdown-incorrect" style={{width:(100-item.accuracy)+"%"}}/></div></div><b>{item.accuracy.toFixed(1)}%<small>accuracy</small></b></div>)}</div>:<EmptyAnalytics title="Your unit-wise report will build here" detail="Complete and submit practice tests containing unit-tagged questions to see unit-level accuracy and progress." />}
          </section>

          <section className="mm-analytics-two-col">
            <article className="mm-analytics-panel">
              <div className="mm-analytics-panel-heading">
                <div><span className="mm-section-kicker">WHAT YOU DO WELL</span><h2>Strengths & weaknesses</h2><p>See which papers, subjects and units need attention.</p></div>
              </div>
              <EmptyAnalytics title="Your strengths are waiting to be identified" detail="MockMaster will highlight your strongest and weakest areas using your actual test results." />
            </article>
            <article className="mm-analytics-panel">
              <div className="mm-analytics-panel-heading">
                <div><span className="mm-section-kicker">NEXT STEPS</span><h2>Revision recommendations</h2><p>Focused suggestions based on your performance.</p></div>
              </div>
              <EmptyAnalytics title="Personalised recommendations will appear here" detail="Once enough test data is available, revision priorities will be based on your weaker units and performance gaps." />
            </article>
          </section>

          <footer className="mm-footer"><span>© {new Date().getFullYear()} MockMaster</span><span>Practice. Improve. Achieve.</span></footer>
        </main>
      </div>

      {profileDialogOpen && (
        <div className="mm-profile-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileDialogOpen(false); }}>
          <section className="mm-profile-modal" role="dialog" aria-modal="true" aria-labelledby="mm-profile-title">
            <div className="mm-profile-modal-heading"><div><span className="mm-section-kicker">ACCOUNT DETAILS</span><h2 id="mm-profile-title">My profile</h2></div><button type="button" aria-label="Close profile" onClick={() => setProfileDialogOpen(false)}>×</button></div>
            <div className="mm-profile-identity"><span className="mm-avatar">{initials || "S"}</span><div><strong>{student.name}</strong><span>{student.email}</span></div></div>
            <dl className="mm-profile-details">
              <div><dt>Full name</dt><dd>{student.name}</dd></div>
              <div><dt>Email address</dt><dd>{student.email}</dd></div>
              <div><dt>Mobile number</dt><dd>{student.phone || "Not provided"}</dd></div>
              <div><dt>Selected examinations</dt><dd>{student.exams.length ? student.exams.join(", ") : "None selected"}</dd></div>
            </dl>
            <button type="button" className="mm-profile-close" onClick={() => setProfileDialogOpen(false)}>Close</button>
          </section>
        </div>
      )}

    </div>
  );
}
