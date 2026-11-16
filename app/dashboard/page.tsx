"use client";
import Link from "next/link";
import {ClipboardList,Grid2X2,Target,Gauge,TrendingUp,Clock3,House,BookOpen,Radio,NotebookPen,Info,UserRound,LogOut,Menu,ChevronDown,Sparkles,ClipboardList,X} from "lucide-react";
import StudentWorkspaceHeader from "@/components/navigation/StudentWorkspaceHeader";

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
  { label: "About Us", href: "/about" },
];

const summaryStats = [
  { label: "Total tests attempted", Icon: ClipboardList },
  { label: "Total questions", Icon: Grid2X2 },
  { label: "Unique questions attempted", Icon: Target },
  { label: "Accuracy", Icon: Gauge },
  { label: "Average score", Icon: TrendingUp },
  { label: "Average time per question", Icon: Clock3 },
];

function EmptyAnalytics({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mm-analytics-empty">
      <span className="mm-empty-icon"><ClipboardList size={20}/></span>
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
  const [dashboardData,setDashboardData]=useState<any>(null);
  const [analyticsLoading,setAnalyticsLoading]=useState(false);
  const [analyticsError,setAnalyticsError]=useState("");
  const [analyticsRefresh,setAnalyticsRefresh]=useState(0);
  const [dateFilter,setDateFilter]=useState("week");
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
        if(error){setAnalyticsError("Could not verify your sign-in. Please retry.");setLoading(false);return;}
        if(!data.user){router.replace("/login");return;}

        if (!active) return;
        const profile = data.user.user_metadata as StudentProfile;
        setStudent({
          name: profile.full_name || "Student",
          email: data.user.email || "",
          exams: Array.isArray(profile.exams) ? profile.exams : [],
          phone: profile.phone_number,
        });


      } catch (loadError) {
        setAnalyticsError(loadError instanceof Error?loadError.message:"Unable to load dashboard data. Please retry.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStudent();
    return () => { active = false; };
  }, [router]);

  useEffect(()=>{
    if(!profileDialogOpen)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setProfileDialogOpen(false);};
    document.addEventListener("keydown",onKey);
    const close=document.querySelector(".mm-profile-modal-heading button") as HTMLButtonElement|null;close?.focus();
    return()=>document.removeEventListener("keydown",onKey);
  },[profileDialogOpen]);

  useEffect(()=>{
    if(!student)return;
    let active=true;
    const db=createSupabaseBrowserClient();
    const now=new Date();
    let from:string|null=null,to:string|null=null;
    if(dateFilter==="week")from=new Date(now.getTime()-7*86400000).toISOString();
    else if(dateFilter==="month")from=new Date(now.getTime()-30*86400000).toISOString();
    else if(dateFilter==="3months")from=new Date(now.getTime()-90*86400000).toISOString();
    else if(dateFilter==="today"){const d=new Date();d.setHours(0,0,0,0);from=d.toISOString();}
    else if(dateFilter==="custom"){from=customFrom?new Date(customFrom+"T00:00:00").toISOString():null;to=customTo?new Date(customTo+"T23:59:59").toISOString():null;}
    setAnalyticsLoading(true);setAnalyticsError("");
    void db.rpc("student_get_dashboard_analytics",{p_from:from,p_to:to}).then(({data,error})=>{
      if(!active)return;
      if(error){setAnalyticsError("Analytics could not be loaded. Retry in a moment. "+error.message);setDashboardData(null);}
      else setDashboardData(data);
      setAnalyticsLoading(false);
    }).catch((e:any)=>{if(active){setAnalyticsError(e?.message||"Analytics could not be loaded.");setAnalyticsLoading(false);}});
    return()=>{active=false;};
  },[student,dateFilter,customFrom,customTo,analyticsRefresh]);

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

  const overall=dashboardData?.overall||{};
  const filteredAttempts:any[]=dashboardData?.attempts||[];
  const paperPerformance:any[]=dashboardData?.papers||[];
  const unitPerformance:any[]=dashboardData?.units||[];
  const formatDuration=(seconds:number|null)=>seconds===null||seconds===undefined?"—":seconds<60?Math.round(seconds)+" sec":Math.floor(seconds/60)+"m "+Math.round(seconds%60)+"s";

  if (loading) {
    return <main className="mm-loading"><span className="mm-loading-mark">M</span><p>Loading your MockMaster dashboard...</p></main>;
  }
  if(!student){
    return <main className="mm-loading" role="alert"><p>{analyticsError||"Your dashboard could not be loaded."}</p><button type="button" onClick={()=>window.location.reload()}>Retry</button></main>;
  }

  const initials = student.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const firstNameRaw = student.name.trim().split(/\s+/)[0] || "Student";
  const firstName = firstNameRaw.charAt(0).toUpperCase() + firstNameRaw.slice(1).toLowerCase();

  const profileMenu = (
    <div className="mm-profile-menu-wrap" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setProfileOpen(false);
    }}>
      <button type="button" className="mm-profile-trigger" aria-haspopup="menu" aria-expanded={profileOpen} aria-label="Open account menu" onClick={() => setProfileOpen((open) => !open)}>
        <span className="mm-avatar">{initials || "S"}</span><span>{firstName}</span><span className="mm-profile-chevron" aria-hidden="true"><ChevronDown size={14}/></span>
      </button>
      {profileOpen && (
        <div className="mm-profile-dropdown" role="menu">
          <div className="mm-profile-dropdown-heading"><strong>{student.name}</strong><span>{student.email}</span></div>
          <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); setProfileDialogOpen(true); }}><span aria-hidden="true"><UserRound size={15}/></span> View profile</button>
          <button type="button" role="menuitem" className="mm-profile-logout" disabled={signingOut} onClick={() => void handleSignOut()}><span aria-hidden="true"><LogOut size={15}/></span> {signingOut ? "Logging out..." : "Log out"}</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="mm-dashboard">
      <aside className={menuOpen ? "mm-sidebar mm-sidebar-open" : "mm-sidebar"}>
        <Link className="mm-brand" href="/"><span className="mm-brand-mark">M</span><span>MockMaster</span></Link>
        <div className="mm-mobile-main-label">MAIN MENU</div>
        <nav className="mm-mobile-main-nav" aria-label="Main navigation">
          {desktopNavigation.map((item, index) => (
            <Link key={item.label} className={index === 0 ? "mm-nav-link mm-nav-active" : "mm-nav-link"} href={item.href} onClick={() => setMenuOpen(false)}>
              <span className="mm-nav-icon">{index===0?<House size={17}/>:index===1?<BookOpen size={17}/>:index===2?<Radio size={17}/>:index===3?<NotebookPen size={17}/>:<Info size={17}/>}</span>{item.label}
            </Link>
          ))}
        </nav>
        <nav className="mm-desktop-nav" aria-label="Main navigation">
          {desktopNavigation.map((item, index) => (
            <Link key={item.label} className={index === 0 ? "mm-nav-link mm-nav-active" : "mm-nav-link"} href={item.href}>{item.label}</Link>
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
              <span aria-hidden="true"><UserRound size={15}/></span> View Profile
            </button>
            <button type="button" className="mm-mobile-account-action mm-mobile-logout" disabled={signingOut} onClick={() => void handleSignOut()}>
              <span aria-hidden="true"><LogOut size={15}/></span> {signingOut ? "Logging out..." : "Log Out"}
            </button>
          </div>
          <div className="mm-help-card">
            <span className="mm-help-icon"><Sparkles size={18}/></span>
            <strong>Keep your momentum</strong>
            <p>Consistent practice builds measurable progress.</p>
          </div>

        </div>
      </aside>

      {menuOpen && <button className="mm-sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <div className="mm-main">
        <StudentWorkspaceHeader showNav={false} leftSlot={<button className="mm-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><Menu size={20}/></button>} rightSlot={profileMenu}/>

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
                <span className="mm-analytics-stat-icon" aria-hidden="true"><stat.Icon size={18} strokeWidth={1.8}/></span>
                <div className="mm-analytics-stat-copy">
                  <span>{stat.label}</span>
                  <strong>{stat.label==="Accuracy"?(overall.accuracy===null||overall.accuracy===undefined?"—":Number(overall.accuracy).toFixed(1)+"%"):stat.label==="Total tests attempted"?Number(overall.attempts||0):stat.label==="Average score"?(overall.average_score===null||overall.average_score===undefined?"—":Number(overall.average_score).toFixed(1)+"%"):stat.label==="Total questions"?Number(overall.total_questions||0):stat.label==="Unique questions attempted"?Number(overall.unique_questions||0):formatDuration(overall.average_time===null?null:Number(overall.average_time))}</strong>
                </div>
              </article>
            ))}
          </section>

          <section className="mm-analytics-panel mm-overall-panel" id="performance">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">PROGRESS TRACKER</span><h2>Performance trends</h2><p>Completed tests for the selected period.</p></div>
              <select className="mm-analytics-filter-select" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filter tests by date">
                <option value="today">Today</option>
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
            {(actionError||analyticsError) && <p className="mm-dashboard-action-error" role="alert">{actionError||analyticsError} <button type="button" onClick={()=>setAnalyticsRefresh(x=>x+1)}>Retry</button></p>}
            {analyticsLoading&&<p className="mm-analytics-loading">Updating analytics…</p>}
            {filteredAttempts.length ? (
              <div className="mm-dashboard-recent-tests">
                {filteredAttempts.slice(0, 20).map((test: any) => {
                  const meta: any = {title:test.title};
                  const pct = Number(test.max_score) > 0 && test.score !== null ? Math.max(0, Math.min(100, Number(test.score) / Number(test.max_score) * 100)) : null;
                  const attempted = Number(test.correct_count || 0) + Number(test.incorrect_count || 0);
                  const right = Number(test.correct_count || 0);
                  const incorrect = Number(test.incorrect_count || 0);
                  const unattempted = Number(test.unanswered_count || 0);
                  const total = attempted + unattempted;
                  return (
                    <article className="mm-unit-card mm-trend-card" key={test.id}>
                      <div className="mm-unit-card-heading mm-trend-card-heading">
                        <h3>{meta?.title || "Mock test"}</h3>
                        <span>{new Date(test.submitted_at || test.started_at).toLocaleDateString("en-IN")}</span>
                      </div>
                      <div className="mm-unit-metrics">
                        <div><strong>{pct === null ? "—" : pct.toFixed(1) + "%"}</strong><small>SCORE</small></div>
                        <div><strong>{right}</strong><small>RIGHT</small></div>
                        <div><strong>{attempted}/{total}</strong><small>ATTEMPTED</small></div>
                      </div>
                      <div className="mm-unit-coverage"><span style={{width: (pct ?? 0) + "%"}} /></div>
                      <div className="mm-trend-card-meta">
                        <span>{test.score === null ? "Score pending" : Number(test.score).toFixed(2) + " / " + Number(test.max_score || 0).toFixed(2) + " marks"}</span>
                        <span>{incorrect} incorrect · {unattempted} unattempted</span>
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

          <section className="mm-analytics-panel" id="paper-analysis">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">PAPER-WISE ANALYSIS</span><h2>Performance by paper</h2><p>Compare scores and accuracy across papers.</p></div>
            </div>
            {paperPerformance.length ? <div className="mm-unit-cards mm-paper-cards">{paperPerformance.map((item: any) => <article className="mm-unit-card mm-paper-card" key={item.id}>
              <div className="mm-unit-card-heading"><h3>{item.name}</h3><span>{item.tests} completed {item.tests === 1 ? "test" : "tests"}</span></div>
              <div className="mm-unit-metrics">
                <div><strong>{item.accuracy === null ? "—" : item.accuracy.toFixed(1) + "%"}</strong><small>ACCURACY</small></div>
                <div><strong>{item.average === null ? "—" : item.average.toFixed(1) + "%"}</strong><small>AVG. SCORE</small></div>
                <div><strong>{item.correct}</strong><small>RIGHT</small></div>
              </div>
              <div className="mm-unit-coverage"><span style={{width: (item.accuracy ?? 0) + "%"}} /></div>
              <div className="mm-paper-card-meta"><span>{item.correct} correct</span><span>{item.incorrect} incorrect</span></div>
            </article>)}</div> : <EmptyAnalytics title="Paper-wise statistics are not available yet" detail="Complete a test with Paper 1 or Paper 2 questions to see your performance here." />}
          </section>

          <section className="mm-analytics-panel mm-unit-panel" id="unit-analysis">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">DETAILED SYLLABUS ANALYSIS</span><h2>Unit-wise performance</h2></div>
            </div>
            {unitPerformance.length ? <div className="mm-unit-cards">{unitPerformance.map((item: any) => <article className="mm-unit-card" key={item.id}>
              <div className="mm-unit-card-heading"><h3>{item.name}</h3><span>{item.paperName}</span></div>
              <div className="mm-unit-metrics">
                <div><strong>{item.accuracy.toFixed(0)}%</strong><small>ACCURACY</small></div>
                <div><strong>{item.correct}</strong><small>RIGHT</small></div>
                <div><strong>{item.attempted}/{item.total}</strong><small>ATTEMPTED</small></div>
              </div>
              <div className="mm-unit-coverage"><span style={{width: item.coverage + "%"}} /></div>
              <p>Coverage {item.coverage.toFixed(0)}%</p>
            </article>)}</div> : <EmptyAnalytics title="Your unit-wise report will build here" detail="Complete tests with unit-tagged questions to see accuracy, attempted questions and syllabus coverage." />}
          </section>


          <footer className="mm-footer"><span>© {new Date().getFullYear()} MockMaster</span><span>Practice. Improve. Achieve.</span></footer>
        </main>
      </div>

      {profileDialogOpen && (
        <div className="mm-profile-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileDialogOpen(false); }}>
          <section className="mm-profile-modal" role="dialog" aria-modal="true" aria-labelledby="mm-profile-title">
            <div className="mm-profile-modal-heading"><div><span className="mm-section-kicker">ACCOUNT DETAILS</span><h2 id="mm-profile-title">My profile</h2></div><button type="button" aria-label="Close profile" onClick={() => setProfileDialogOpen(false)}><X size={17}/></button></div>
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
