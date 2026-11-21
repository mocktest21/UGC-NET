"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, Bell, BookOpen, CalendarDays, CheckCircle2,
  CircleHelp, Clock3, GraduationCap, House, LogOut, Menu, NotebookPen,
  Radio, RefreshCw, ShieldCheck, Sparkles, Target, TrendingUp, UserRound, X
} from "lucide-react";
import StudentWorkspaceHeader from "@/components/navigation/StudentWorkspaceHeader";
import MockMasterLoading from "@/app/components/ui/MockMasterLoading";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import "./home.css";

type Preferences = {
  category: string | null;
  is_pwd: boolean;
  qualification_goal: "Assistant Professor" | "JRF" | "Both" | null;
  target_exam_cycle: string | null;
  subject_name?: string | null;
};
type Attempt = {
  id: string;
  title?: string | null;
  score: number | null;
  max_score: number | null;
  submitted_at?: string | null;
  status?: string | null;
  percentage?: number | null;
};
type ReadinessData = { full_length_mock_count?: number; attempts?: Attempt[] };
type HomeData = {
  overall?: {
    attempts?: number;
    completed_tests?: number;
    total_questions?: number;
    unique_questions?: number;
    average_score?: number | null;
    accuracy?: number | null;
    average_time?: number | null;
  };
  attempts?: Attempt[];
};

const fmt = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : Number(value).toLocaleString("en-IN", { maximumFractionDigits: 1 });
const duration = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined) return "—";
  return seconds < 60 ? Math.round(seconds) + " sec" : Math.floor(seconds / 60) + "m " + Math.round(seconds % 60) + "s";
};

export default function HomePage() {
  const router = useRouter();
  const [student, setStudent] = useState({ name: "Student", email: "", phone: "" });
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [data, setData] = useState<HomeData | null>(null);
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function loadHome(initial = false) {
    if (initial) setLoading(true); else setRefreshing(true);
    setError("");
    try {
      const db = createSupabaseBrowserClient();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) { router.replace("/login"); return; }
      const meta = auth.user.user_metadata || {};
      setStudent({
        name: meta.full_name || "Student",
        email: auth.user.email || "",
        phone: meta.phone_number || ""
      });

      const [prefResult, analyticsResult, readinessResult] = await Promise.all([
        db.from("student_exam_preferences")
          .select("category,is_pwd,qualification_goal,target_exam_cycle,subjects(name)")
          .eq("student_id", auth.user.id)
          .limit(1)
          .maybeSingle(),
        db.rpc("student_get_dashboard_analytics", { p_from: null, p_to: null }),
        db.rpc("student_get_readiness_metrics")
      ]);
      if (prefResult.error) throw prefResult.error;
      if (analyticsResult.error) throw analyticsResult.error;
      if (readinessResult.error) throw readinessResult.error;
      const pref = prefResult.data as any;
      setPreferences(pref ? {
        category: pref.category,
        is_pwd: Boolean(pref.is_pwd),
        qualification_goal: pref.qualification_goal,
        target_exam_cycle: pref.target_exam_cycle,
        subject_name: Array.isArray(pref.subjects) ? pref.subjects[0]?.name : pref.subjects?.name
      } : null);
      setData((analyticsResult.data || {}) as HomeData);
      setReadiness((readinessResult.data || {}) as ReadinessData);
    } catch (e: any) {
      setError(e?.message || "Home could not be loaded. Please retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void loadHome(true); }, []);

  const initials = student.name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  const firstName = student.name.trim().split(/\s+/)[0] || "Student";
  const overall = data?.overall || {};
  const fullLengthAttempts = readiness?.attempts || [];
  const scoredAttempts = fullLengthAttempts.filter(a => a.score !== null && Number(a.max_score) > 0);
  const latestFive = scoredAttempts.slice(0, 5);
  const fullLengthCount = Number(readiness?.full_length_mock_count || 0);
  const averageRecent = latestFive.length
    ? latestFive.reduce((sum, a) => sum + (Number(a.score) / Number(a.max_score) * 100), 0) / latestFive.length
    : null;
  const profileComplete = Boolean(preferences?.category && preferences?.qualification_goal && preferences?.target_exam_cycle && preferences?.subject_name);
  const readinessStatus = !profileComplete || scoredAttempts.length < 5
    ? "Insufficient Data"
    : "Benchmark Pending";
  const recentTrend = useMemo(() => {
    if (latestFive.length < 2) return null;
    const chronological = [...latestFive].reverse();
    const first = Number(chronological[0].score) / Number(chronological[0].max_score) * 100;
    const last = Number(chronological[chronological.length - 1].score) / Number(chronological[chronological.length - 1].max_score) * 100;
    return last - first;
  }, [data]);

  async function signOut() {
    setSigningOut(true);
    const db = createSupabaseBrowserClient();
    await db.auth.signOut();
    router.replace("/login");
  }

  if (loading) return <MockMasterLoading variant="workspace" title="Preparing your Home" message="Loading your exam profile and progress." />;

  return (
    <div className="mm-home-page">
      <aside className={menuOpen ? "mm-home-sidebar open" : "mm-home-sidebar"}>
        <Link className="mm-home-brand" href="/dashboard"><span className="mm-home-brand-mark">M</span><span>MockMaster</span></Link>
        <span className="mm-home-nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          <Link className="active" href="/dashboard" onClick={() => setMenuOpen(false)}><House size={17}/>Home</Link>
          <Link href="/practice" onClick={() => setMenuOpen(false)}><BookOpen size={17}/>Practice</Link>
          <Link href="/live-test" onClick={() => setMenuOpen(false)}><Radio size={17}/>Live Test</Link>
          <Link href="/personal-notebook" onClick={() => setMenuOpen(false)}><NotebookPen size={17}/>Personal Notebook</Link>
          <Link href="/analytics" onClick={() => setMenuOpen(false)}><Activity size={17}/>Analytics</Link>
        </nav>
        <div className="mm-home-sidebar-bottom">
          <div className="mm-home-profile-wrap">
            <button className="mm-home-profile-trigger" type="button" onClick={() => setProfileOpen(v => !v)}>
              <span className="mm-home-avatar">{initials || "S"}</span>
              <span className="mm-home-profile-name"><strong>{student.name}</strong><small>Student account</small></span>
              <span aria-hidden="true">⋯</span>
            </button>
            {profileOpen && <div className="mm-home-profile-menu">
              <button type="button" onClick={() => { setProfileDialogOpen(true); setProfileOpen(false); }}><UserRound size={15}/>View profile</button>
              <button type="button" disabled={signingOut} onClick={() => void signOut()}><LogOut size={15}/>{signingOut ? "Logging out…" : "Log out"}</button>
            </div>}
          </div>
          <div className="mm-home-sidebar-note"><Sparkles size={16}/><span><strong>Stay consistent</strong><small>Small, regular practice adds up.</small></span></div>
        </div>
      </aside>
      {menuOpen && <button className="mm-home-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}

      <div className="mm-home-main">
        <StudentWorkspaceHeader showNav={false} leftSlot={<button className="mm-home-menu-toggle" aria-label="Toggle menu" onClick={() => setMenuOpen(v => !v)}><Menu size={20}/></button>} rightSlot={<button className="mm-home-refresh" type="button" aria-label="Refresh Home" title="Refresh" disabled={refreshing} onClick={() => void loadHome(false)}><RefreshCw size={16} className={refreshing ? "spin" : ""}/></button>}/>
        <main className="mm-home-content">
          <section className="mm-home-welcome">
            <div><span className="mm-home-eyebrow">YOUR UGC-NET WORKSPACE</span><h1>Welcome back, {firstName}!</h1><p>Stay focused on your target. Your preparation, your progress, one step at a time.</p>
              <div className="mm-home-profile-tags">
                {preferences?.subject_name && <span><BookOpen size={13}/>{preferences.subject_name}</span>}
                {preferences?.target_exam_cycle && <span><CalendarDays size={13}/>{preferences.target_exam_cycle}</span>}
                {preferences?.qualification_goal && <span><GraduationCap size={13}/>{preferences.qualification_goal}</span>}
              </div>
            </div>
            <div className="mm-home-welcome-icon"><GraduationCap size={38}/></div>
          </section>

          {error && <div className="mm-home-error" role="alert">{error}<button type="button" onClick={() => void loadHome(false)}>Retry</button></div>}

          <section className="mm-home-grid-top">
            <article className="mm-home-card mm-home-countdown">
              <div className="mm-home-card-title"><span className="mm-home-icon"><CalendarDays size={18}/></span><span>EXAM COUNTDOWN</span></div>
              <h2>{preferences?.target_exam_cycle || "Target cycle not set"}</h2>
              <strong className="mm-home-awaiting">Official exam date awaited</strong>
              <p>Countdown will start when NTA publishes the confirmed schedule.</p>
            </article>
            <article className="mm-home-card mm-home-readiness">
              <div className="mm-home-card-title"><span className="mm-home-icon"><Target size={18}/></span><span>EXAM READINESS</span></div>
              <div className="mm-home-readiness-status"><span className="mm-home-status-dot"/>{readinessStatus}</div>
              <p>{!profileComplete ? "Complete your exam profile to identify the relevant qualification benchmark." : scoredAttempts.length < 5 ? "Complete at least five eligible full-length UGC-NET mocks to establish a more reliable baseline." : "Your mock-test baseline is available. An official, matching cutoff benchmark is still required before readiness can be classified."}</p>
              <div className="mm-home-readiness-foot"><span>{fullLengthCount} eligible full-length mocks</span><span>{profileComplete ? "Profile complete" : "Profile incomplete"}</span></div>
            </article>
          </section>

          <section className="mm-home-section">
            <div className="mm-home-section-heading"><div><span className="mm-home-eyebrow">YOUR CURRENT BASELINE</span><h2>Preparation snapshot</h2><p>Summary of completed test activity. Open Analytics for detailed breakdowns.</p></div><Link href="/analytics">View Analytics <ArrowRight size={15}/></Link></div>
            <div className="mm-home-stats">
              <article><span className="mm-home-stat-icon"><ClipboardIcon/></span><div><strong>{fmt(overall.attempts ?? overall.completed_tests)}</strong><small>Completed tests</small></div></article>
              <article><span className="mm-home-stat-icon"><Target size={18}/></span><div><strong>{fmt(overall.unique_questions)}</strong><small>Unique questions attempted</small></div></article>
              <article><span className="mm-home-stat-icon"><TrendingUp size={18}/></span><div><strong>{averageRecent === null ? "—" : averageRecent.toFixed(1) + "%"}</strong><small>Full-mock average · latest {latestFive.length || 0}</small></div></article>
              <article><span className="mm-home-stat-icon"><Activity size={18}/></span><div><strong>{fmt(overall.accuracy)}{overall.accuracy == null ? "" : "%"}</strong><small>Overall accuracy</small></div></article>
              <article><span className="mm-home-stat-icon"><CircleHelp size={18}/></span><div><strong>{fmt(overall.total_questions)}</strong><small>Questions attempted</small></div></article>
              <article><span className="mm-home-stat-icon"><Clock3 size={18}/></span><div><strong>{duration(overall.average_time)}</strong><small>Average time / question</small></div></article>
            </div>
          </section>

          <section className="mm-home-grid-bottom">
            <article className="mm-home-card mm-home-pace">
              <div className="mm-home-card-title"><span className="mm-home-icon"><TrendingUp size={18}/></span><span>REQUIRED PACE</span></div>
              <h2>{recentTrend === null ? "Baseline building" : recentTrend > 0.5 ? "Positive score movement" : recentTrend < -0.5 ? "Review your recent trend" : "Score trend is steady"}</h2>
              <p>{latestFive.length < 5 ? "Complete five eligible full-length UGC-NET mocks first. Then we can calculate a realistic weekly improvement target against the correct subject, category and qualification benchmark." : "Your recent mock trend is available. A precise required pace will be shown after the relevant official cutoff benchmark and exam date are verified."}</p>
              {recentTrend !== null && <div className="mm-home-trend-chip">{recentTrend > 0 ? "+" : ""}{recentTrend.toFixed(1)} percentage points across recent mocks</div>}
              <Link href="/practice">Go to Practice <ArrowRight size={15}/></Link>
            </article>
            <article className="mm-home-card mm-home-updates">
              <div className="mm-home-card-title"><span className="mm-home-icon"><Bell size={18}/></span><span>OFFICIAL UGC-NET UPDATES</span></div>
              <h2>Verified notices</h2>
              <div className="mm-home-empty-update"><ShieldCheck size={22}/><strong>No verified notice published here yet</strong><p>Only NTA or UGC notices with a source link and publication date will appear in this section.</p></div>
              <a href="https://ugcnet.nta.ac.in/" target="_blank" rel="noreferrer">Visit official UGC-NET website <ArrowRight size={14}/></a>
            </article>
          </section>

          <footer className="mm-home-footer"><span>© {new Date().getFullYear()} MockMaster</span><span>Practice. Improve. Achieve.</span></footer>
        </main>
      </div>

      {profileDialogOpen && <div className="mm-home-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setProfileDialogOpen(false); }}>
        <section className="mm-home-modal" role="dialog" aria-modal="true" aria-labelledby="mm-home-profile-title">
          <div className="mm-home-modal-head"><div><span className="mm-home-eyebrow">ACCOUNT DETAILS</span><h2 id="mm-home-profile-title">My profile</h2></div><button type="button" aria-label="Close profile" onClick={() => setProfileDialogOpen(false)}><X size={18}/></button></div>
          <div className="mm-home-modal-identity"><span className="mm-home-avatar">{initials || "S"}</span><div><strong>{student.name}</strong><small>{student.email}</small></div></div>
          <dl><div><dt>Full name</dt><dd>{student.name}</dd></div><div><dt>Email address</dt><dd>{student.email}</dd></div><div><dt>Mobile number</dt><dd>{student.phone || "Not provided"}</dd></div><div><dt>Paper 2 subject</dt><dd>{preferences?.subject_name || "Not selected"}</dd></div><div><dt>Category</dt><dd>{preferences?.category || "Not provided"}</dd></div><div><dt>PwBD</dt><dd>{preferences?.is_pwd ? "Yes" : "No"}</dd></div><div><dt>Qualification goal</dt><dd>{preferences?.qualification_goal || "Not provided"}</dd></div><div><dt>Target exam cycle</dt><dd>{preferences?.target_exam_cycle || "Not provided"}</dd></div></dl>
          <button className="mm-home-modal-close" type="button" onClick={() => setProfileDialogOpen(false)}>Close</button>
        </section>
      </div>}
    </div>
  );
}

function ClipboardIcon() {
  return <BookOpen size={18}/>;
}
