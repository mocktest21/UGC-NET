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

const navigation = [
  { label: "Overview", icon: "⌂", href: "#overview" },
  { label: "My examinations", icon: "▤", href: "#examinations" },
  { label: "Practice centre", icon: "◎", href: "#practice" },
  { label: "Performance", icon: "↗", href: "#performance" },
];

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
  { label: "Questions attempted", icon: "◉", note: "Questions included in your completed tests" },
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
  const [analytics,setAnalytics]=useState({tests:0,average:"—",accuracy:"—",totalQuestions:0,uniqueQuestions:0,recent:[] as any[],subjects:[] as any[],units:[] as any[]});

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
        const {data:attemptRows}=await supabase.from("test_attempts")
          .select("id,score,max_score,accuracy,questions_attempted,correct_count,incorrect_count,unanswered_count,status,started_at")
          .eq("student_id",data.user.id).in("status",["submitted","auto_submitted"]).order("started_at",{ascending:false}).limit(200);
        const attempts=(attemptRows||[]) as any[];
        const scored=attempts.filter(a=>a.score!==null&&a.max_score!==null&&Number(a.max_score)>0);
        const avg=scored.length?scored.reduce((sum,a)=>sum+(Number(a.score)/Number(a.max_score))*100,0)/scored.length:null;
        const correct=attempts.reduce((sum,a)=>sum+Number(a.correct_count||0),0);
        const attempted=attempts.reduce((sum,a)=>sum+Number(a.questions_attempted||0),0);
        const accuracyRows=attempts.filter(a=>a.accuracy!==null);
        const accuracy=accuracyRows.length?accuracyRows.reduce((sum,a)=>sum+Number(a.accuracy),0)/accuracyRows.length*100:null;
        const total=attempts.reduce((sum,a)=>sum+Number(a.questions_attempted||0)+Number(a.unanswered_count||0),0);
        const attemptIds=attempts.map(a=>a.id);
        let subjectPerformance:any[]=[];
        let unitPerformance:any[]=[];
        if(attemptIds.length){
          const {data:responseRows}=await supabase.from("student_responses").select("attempt_id,test_question_id,is_correct,awarded_marks,time_spent_seconds").in("attempt_id",attemptIds);
          const responses=(responseRows||[]) as any[];
          const tqIds=Array.from(new Set(responses.map(r=>r.test_question_id).filter(Boolean)));
          if(tqIds.length){
            const {data:tqRows}=await supabase.from("test_questions").select("id,question_id").in("id",tqIds);
            const questionIds=Array.from(new Set((tqRows||[]).map((r:any)=>r.question_id).filter(Boolean)));
            if(questionIds.length){
              const {data:questionRows}=await supabase.from("questions").select("id,subject_id,unit_id,subjects(name),units(name)").in("id",questionIds);
              const questionById=new Map((tqRows||[]).map((r:any)=>[r.id,(questionRows||[]).find((q:any)=>q.id===r.question_id)]));
              const subjectMap=new Map<string,any>();
              const unitMap=new Map<string,any>();
              for(const response of responses){
                if(response.is_correct===null||response.is_correct===undefined)continue;
                const tq=(tqRows||[]).find((r:any)=>r.id===response.test_question_id);
                const q=tq?questionById.get(tq.id) as any:null;
                if(!q)continue;
                const subjectName=Array.isArray(q.subjects)?q.subjects[0]?.name:q.subjects?.name;
                const unitName=Array.isArray(q.units)?q.units[0]?.name:q.units?.name;
                const add=(map:Map<string,any>,id:string| null,name:string|undefined)=>{
                  if(!id)return;
                  const item=map.get(id)||{id,name:name||"Unlabelled",attempted:0,correct:0,incorrect:0,time:0};
                  item.attempted++;if(response.is_correct)item.correct++;else item.incorrect++;
                  item.time+=Number(response.time_spent_seconds||0);map.set(id,item);
                };
                add(subjectMap,q.subject_id,subjectName);
                add(unitMap,q.unit_id,unitName);
              }
              const format=(map:Map<string,any>)=>Array.from(map.values()).map(x=>({...x,accuracy:x.attempted?x.correct/x.attempted*100:0,avgTime:x.attempted?x.time/x.attempted:0})).sort((a,b)=>b.attempted-a.attempted);
              subjectPerformance=format(subjectMap);unitPerformance=format(unitMap);
            }
          }
        }
        if(active)setAnalytics({tests:attempts.length,average:avg===null?"—":avg.toFixed(1)+"%",accuracy:accuracy===null?"—":accuracy.toFixed(1)+"%",totalQuestions:total,uniqueQuestions:attempted,recent:attempts.slice(0,5).map(a=>({id:a.id,score:a.score===null?null:Number(a.score),max_score:a.max_score===null?null:Number(a.max_score),started_at:a.started_at,questions_attempted:Number(a.questions_attempted||0)})),subjects:subjectPerformance,units:unitPerformance});

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
        <div className="mm-side-label">STUDENT WORKSPACE</div>
        <nav className="mm-side-nav" aria-label="Student navigation">
          {navigation.map((item, index) => (
            <a key={item.label} className={index === 0 ? "mm-nav-link mm-nav-active" : "mm-nav-link"} href={item.label === "Practice centre" ? "/practice" : item.label === "My examinations" ? "/dashboard#examinations" : item.label === "Performance" ? "/dashboard#performance" : "/dashboard"} onClick={() => setMenuOpen(false)}>
              <span className="mm-nav-icon">{item.icon}</span>{item.label}
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
          <button className="mm-menu-toggle" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>☰</button>
          <div className="mm-mobile-page-label">Performance dashboard</div>
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
                  <strong>{stat.label==="Tests attempted"?analytics.tests:stat.label==="Average score"?analytics.average:stat.label==="Accuracy"?analytics.accuracy:stat.label==="Total questions"?analytics.totalQuestions:stat.label==="Questions attempted"?analytics.uniqueQuestions:"—"}</strong>
                  <small>{stat.note}</small>
                </div>
              </article>
            ))}
          </section>

          <section className="mm-analytics-panel mm-overall-panel" id="performance">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">PROGRESS TRACKER</span><h2>Performance trends</h2><p>Your scores and accuracy will be plotted as you complete tests.</p></div>
              <span className="mm-analytics-filter">All time</span>
            </div>
            {analytics.recent.length?<div className="mm-dashboard-recent-tests">{analytics.recent.map((test,index)=><div key={test.id}><span>Test {analytics.tests-index}</span><b>{test.score!==null&&test.max_score?((test.score/test.max_score)*100).toFixed(1)+"%":"Submitted"}</b><small>{test.questions_attempted} questions attempted · {new Date(test.started_at).toLocaleDateString("en-IN")}</small></div>)}</div>:<EmptyAnalytics title="Your performance trend will appear here" detail="Complete a test to start tracking your score and accuracy trends over time." />}
          </section>

          <section className="mm-analytics-panel" id="examinations">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">EXAM-WISE OVERVIEW</span><h2>My examinations</h2><p>Performance will be organised separately for each examination you have selected.</p></div>
              <span className="mm-count-pill">{student.exams.length} selected</span>
            </div>
            {student.exams.length ? (
              <div className="mm-analytics-exam-grid">
                {student.exams.map((exam) => (
                  <article className="mm-analytics-exam-card" key={exam}>
                    <div className="mm-analytics-exam-top"><span className="mm-analytics-exam-icon">▤</span><span className="mm-analytics-status">Selected</span></div>
                    <h3>{exam}</h3>
                    <div className="mm-analytics-exam-metrics">
                      <div><strong>—</strong><span>Tests</span></div>
                      <div><strong>—</strong><span>Average score</span></div>
                      <div><strong>—</strong><span>Accuracy</span></div>
                    </div>
                    <p>Statistics will populate after test attempts are recorded.</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyAnalytics title="No examinations selected" detail="Your selected examinations will appear here after you update your profile." />
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
              {analytics.subjects.length?<div className="mm-dashboard-breakdown">{analytics.subjects.map((item:any)=><div className="mm-dashboard-breakdown-row" key={item.id}><div><strong>{item.name}</strong><small>{item.attempted} evaluated questions · {item.correct} correct · {item.incorrect} incorrect</small></div><b>{item.accuracy.toFixed(1)}%<small>accuracy</small></b></div>)}</div>:<EmptyAnalytics title="Subject analysis will appear here" detail="Complete and submit subject-wise practice tests to build your performance record." />}
            </article>
          </section>

          <section className="mm-analytics-panel mm-unit-panel" id="unit-analysis">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">DETAILED SYLLABUS ANALYSIS</span><h2>Unit-wise performance</h2><p>Identify strong units, weak units and your progress across the syllabus.</p></div>
              <span className="mm-unit-badge">Core analytics</span>
            </div>
            {analytics.units.length?<div className="mm-dashboard-breakdown">{analytics.units.map((item:any)=><div className="mm-dashboard-breakdown-row" key={item.id}><div><strong>{item.name}</strong><small>{item.attempted} evaluated questions · {item.correct} correct · {item.incorrect} incorrect</small></div><b>{item.accuracy.toFixed(1)}%<small>accuracy</small></b></div>)}</div>:<EmptyAnalytics title="Your unit-wise report will build here" detail="Complete and submit practice tests containing unit-tagged questions to see unit-level accuracy and progress." />}
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

      <nav className="mm-bottom-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 4).map((item, index) => (
          <a key={item.label} className={index === 0 ? "mm-bottom-link mm-bottom-active" : "mm-bottom-link"} href={item.label === "Practice centre" ? "/practice" : item.label === "My examinations" ? "/dashboard#examinations" : item.label === "Performance" ? "/dashboard#performance" : "/dashboard"}>
            <span>{item.icon}</span><small>{index === 0 ? "Home" : index === 1 ? "Exams" : index === 2 ? "Practice" : "Progress"}</small>
          </a>
        ))}
      </nav>
    </div>
  );
}
