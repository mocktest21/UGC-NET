"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, Bell, BookOpen, CalendarDays, CheckCircle2,
  CircleHelp, Clock3, Eye, GraduationCap, House, LogOut, Menu, NotebookPen,
  Radio, ShieldCheck, Sparkles, Target, TrendingUp, UserRound, X
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
  const [examScheduleDate, setExamScheduleDate] = useState<string | null>(null);
  const [notices, setNotices] = useState<{id:number;title:string;source_url:string;first_seen_at:string;new_until:string|null}[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [subjectOptions, setSubjectOptions] = useState<{id:string;name:string}[]>([]);
  const [editProfile, setEditProfile] = useState({name:"",phone:"",subjectId:"",category:"",isPwd:false,goal:"Both",cycle:"June 2027"});
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
          .select("selected_subject_id,category,is_pwd,qualification_goal,target_exam_cycle,subjects(name)")
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
      const examCycle = String(pref?.target_exam_cycle || "December 2026");
      const { data: scheduleRow } = await db.from("exam_schedule_settings").select("exam_date").eq("exam_cycle", examCycle).maybeSingle();
      const monthMatch = examCycle.match(/^([A-Za-z]+)\\s+(\\d{4})$/);
      const monthIndex = monthMatch ? new Date(Date.parse(monthMatch[1] + " 1, " + monthMatch[2])).getMonth() : 11;
      const yearNumber = monthMatch ? Number(monthMatch[2]) : 2026;
      const fallbackDate = new Date(yearNumber, monthIndex, 15);
      const fallbackIso = fallbackDate.getFullYear()+"-"+String(fallbackDate.getMonth()+1).padStart(2,"0")+"-"+String(fallbackDate.getDate()).padStart(2,"0");
      setExamScheduleDate(scheduleRow?.exam_date || fallbackIso);
      setPreferences(pref ? {
        category: pref.category,
        is_pwd: Boolean(pref.is_pwd),
        qualification_goal: pref.qualification_goal,
        target_exam_cycle: pref.target_exam_cycle,
        subject_name: Array.isArray(pref.subjects) ? pref.subjects[0]?.name : pref.subjects?.name
      } : null);
      const { data: exam } = await db.from("exams").select("id").eq("code", "UGC_NET").maybeSingle();
      const { data: paper } = exam ? await db.from("papers").select("id").eq("exam_id", exam.id).eq("code", "PAPER_2").maybeSingle() : { data: null };
      const { data: subjectRows } = paper ? await db.from("subjects").select("id,name").eq("paper_id", paper.id).eq("is_active", true).order("display_order") : { data: [] };
      setSubjectOptions(subjectRows || []);
      setEditProfile({ name: meta.full_name || "Student", phone: meta.phone_number || "", subjectId: pref?.selected_subject_id || "", category: pref?.category || "", isPwd: Boolean(pref?.is_pwd), goal: pref?.qualification_goal || "Both", cycle: pref?.target_exam_cycle || "June 2027" });
      setData((analyticsResult.data || {}) as HomeData);
      setReadiness((readinessResult.data || {}) as ReadinessData);
      const { data: noticeRows } = await db.from("nta_ugcnet_notices")
        .select("id,title,source_url,first_seen_at,new_until")
        .eq("is_active", true)
        .order("source_order", { ascending: true })
        .limit(6);
      setNotices(noticeRows || []);
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

  function beginEditProfile() {
    setEditProfile(v => ({...v, name: student.name, phone: student.phone}));
    setProfileError(""); setProfileSuccess(""); setEditingProfile(true);
  }

  async function saveProfile() {
    setSavingProfile(true); setProfileError(""); setProfileSuccess("");
    try {
      const db = createSupabaseBrowserClient();
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) throw authError || new Error("Please log in again.");
      const { data: exam, error: examError } = await db.from("exams").select("id").eq("code", "UGC_NET").maybeSingle();
      if (examError || !exam) throw examError || new Error("UGC NET setup not found.");
      const { error: prefError } = await db.from("student_exam_preferences").upsert({ student_id:user.id, exam_id:exam.id, selected_subject_id:editProfile.subjectId || null, category:editProfile.category || null, is_pwd:editProfile.isPwd, qualification_goal:editProfile.goal || null, target_exam_cycle:editProfile.cycle || null }, { onConflict:"student_id,exam_id" });
      if (prefError) throw prefError;
      const { error: updateError } = await db.auth.updateUser({ data:{ full_name:editProfile.name.trim(), phone_number:editProfile.phone.trim(), paper2_subject_id:editProfile.subjectId, category:editProfile.category, is_pwd:editProfile.isPwd, qualification_goal:editProfile.goal, target_attempt:editProfile.cycle } });
      if (updateError) throw updateError;
      setStudent(v => ({...v, name:editProfile.name.trim(), phone:editProfile.phone.trim()}));
      setPreferences({category:editProfile.category, is_pwd:editProfile.isPwd, qualification_goal:editProfile.goal as Preferences["qualification_goal"], target_exam_cycle:editProfile.cycle, subject_name:subjectOptions.find(x=>x.id===editProfile.subjectId)?.name || null});
      setProfileSuccess("Profile updated successfully."); setEditingProfile(false);
    } catch (e:any) { setProfileError(e?.message || "Profile could not be updated."); }
    finally { setSavingProfile(false); }
  }

  async function signOut() {
    setSigningOut(true);
    const db = createSupabaseBrowserClient();
    await db.auth.signOut();
    router.replace("/login");
  }

  if (loading) return <MockMasterLoading variant="workspace" title="Preparing your Home" message="Loading your exam profile and progress." />;

  return (
    <div className="mm-home-page">
      <div className="mm-home-main">
        <StudentWorkspaceHeader
          showNav={true}
          rightSlot={
            <div className="mm-home-header-actions">
              <div className="mm-home-profile-wrap">
                <button className="mm-home-name-trigger" type="button" onClick={() => setProfileOpen(v => !v)} aria-label="Open account menu"><span className="mm-home-trigger-avatar"><UserRound size={16}/></span><span className="mm-home-trigger-name">{student.name}</span><span className="mm-home-trigger-chevron" aria-hidden="true">⌄</span></button>
                {profileOpen && <div className="mm-home-profile-menu">
                  <button type="button" onClick={() => { setProfileDialogOpen(true); setProfileOpen(false); setEditingProfile(false); }}><UserRound size={15}/>View profile</button>
                  <button type="button" disabled={signingOut} onClick={() => void signOut()}><LogOut size={15}/>{signingOut ? "Logging out…" : "Log out"}</button>
                </div>}
              </div>
            </div>
          }
          mobileMenuExtra={
            <div className="mm-home-mobile-account">
              <strong>{student.name}</strong>
              <button type="button" onClick={() => { setProfileDialogOpen(true); setProfileOpen(false); setEditingProfile(false); }}><UserRound size={15}/>View profile</button>
              <button type="button" disabled={signingOut} onClick={() => void signOut()}><LogOut size={15}/>{signingOut ? "Logging out…" : "Log out"}</button>
            </div>
          }
        />
        <main className="mm-home-content">
          <section className="mm-home-welcome">
            <div className="mm-home-welcome-main">
              <span className="mm-home-greeting">{new Date().getHours()<12?"Good morning,":new Date().getHours()<17?"Good afternoon,":"Good evening,"}</span>
              <h1>{firstName}</h1>
              <div className="mm-home-welcome-meta">
                <div><small>EXAM</small><strong>UGC-NET</strong></div>
                <div><small>SUBJECT</small><strong>{preferences?.subject_name || "Not selected"}</strong></div>
                <div><small>PAPERS</small><strong>1 + 2</strong></div>
              </div>
            </div>
            <div className="mm-home-welcome-icon"><GraduationCap size={28}/></div>
          </section>

          {error && <div className="mm-home-error" role="alert">{error}<button type="button" onClick={() => void loadHome(false)}>Retry</button></div>}

          <section className="mm-home-grid-top">
            <article className="mm-home-card mm-home-countdown">
              {(() => {
                const target = examScheduleDate ? new Date(examScheduleDate + "T00:00:00") : null;
                const today = new Date(); today.setHours(0,0,0,0);
                const days = target ? Math.ceil((target.getTime()-today.getTime())/86400000) : null;
                const weeks = days !== null && days > 0 ? Math.floor(days/7) : 0;
                const rest = days !== null && days > 0 ? days%7 : 0;
                return <>
                  <div className="mm-home-countdown-top"><div className="mm-home-countdown-label"><span>◷</span> EXAM COUNTDOWN</div>{days !== null && days <= 30 && days > 0 && <span className="mm-home-countdown-badge">Final stretch</span>}</div>
                  <div className="mm-home-countdown-hero"><strong>{days===null?"—":days>0?days:days===0?"Today":Math.abs(days)}</strong><div><b>{days===0?"Exam day":days!==null&&days<0?"days overdue":"days to go"}</b><span>UGC-NET · {preferences?.target_exam_cycle || "December 2026"}</span></div></div>
                  {days!==null&&days>0&&<div className="mm-home-countdown-pills"><span>{weeks>0?weeks+" weeks ":""}{rest>0?rest+" days":""} left</span><span>{days*24} hours</span></div>}
                  <Link className="mm-home-countdown-cta" href="/practice">Start today's practice <ArrowRight size={17}/></Link>
                </>;
              })()}
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
              <div className="mm-home-notice-heading"><div><h2>Latest notices</h2><p>Latest 6 notices from the official NTA website</p></div><span className="mm-home-verified"><ShieldCheck size={13}/> Verified</span></div>
              {notices.length ? <div className="mm-home-notice-list">
                {notices.map(notice => {
                  const isNew = Boolean(notice.new_until && Date.now() < new Date(notice.new_until).getTime());
                  return <article className="mm-home-notice-item" key={notice.id}>
                    <div className="mm-home-notice-meta">{isNew && <span className="mm-home-new-badge">LATEST</span>}</div>
                    <span className="mm-home-notice-title">{notice.title}</span>
                    <a className="mm-home-notice-view" href={notice.source_url} target="_blank" rel="noopener noreferrer" aria-label={`View notice: ${notice.title}`} title="View official notice"><Eye size={17}/></a>
                  </article>;
                })}
              </div> : <div className="mm-home-empty-update"><ShieldCheck size={22}/><strong>No notices loaded yet</strong><p>Notices will appear here after the first successful NTA check.</p></div>}
              <a className="mm-home-notice-source" href="https://ugcnet.nta.nic.in/" target="_blank" rel="noreferrer">Visit official UGC-NET website <ArrowRight size={14}/></a>
            </article>
          </section>

          <footer className="mm-home-footer"><span>© {new Date().getFullYear()} MockMaster</span><span>Practice. Improve. Achieve.</span></footer>
        </main>
      </div>

      {profileDialogOpen && <div className="mm-home-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setProfileDialogOpen(false); }}>
        <section className="mm-home-modal" role="dialog" aria-modal="true" aria-labelledby="mm-home-profile-title">
          <div className="mm-home-modal-head"><div><span className="mm-home-eyebrow">ACCOUNT DETAILS</span><h2 id="mm-home-profile-title">My profile</h2></div><button type="button" aria-label="Close profile" onClick={() => setProfileDialogOpen(false)}><X size={18}/></button></div>
          <div className="mm-home-modal-identity"><span className="mm-home-avatar">{initials || "S"}</span><div><strong>{student.name}</strong><small>{student.email}</small></div></div>
          {profileSuccess && <p className="mm-home-profile-success" role="status">{profileSuccess}</p>}
          {profileError && <p className="mm-home-profile-error" role="alert">{profileError}</p>}
          {editingProfile ? <div className="mm-home-edit-form">
            <label>Full name<input value={editProfile.name} onChange={e=>setEditProfile(v=>({...v,name:e.target.value}))} required /></label>
            <label>Mobile number<input value={editProfile.phone} onChange={e=>setEditProfile(v=>({...v,phone:e.target.value}))} inputMode="tel" /></label>
            <label>Paper 2 subject<select value={editProfile.subjectId} onChange={e=>setEditProfile(v=>({...v,subjectId:e.target.value}))}><option value="">Select subject</option>{subjectOptions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label>Category<select value={editProfile.category} onChange={e=>setEditProfile(v=>({...v,category:e.target.value}))}><option value="">Select category</option>{["General","EWS","OBC-NCL","SC","ST"].map(x=><option key={x}>{x}</option>)}</select></label>
            <label>PwBD<select value={editProfile.isPwd?"yes":"no"} onChange={e=>setEditProfile(v=>({...v,isPwd:e.target.value==="yes"}))}><option value="no">No</option><option value="yes">Yes</option></select></label>
            <label>Qualification goal<select value={editProfile.goal} onChange={e=>setEditProfile(v=>({...v,goal:e.target.value}))}>{["Assistant Professor","JRF","Both"].map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Target exam cycle<select value={editProfile.cycle} onChange={e=>setEditProfile(v=>({...v,cycle:e.target.value}))}>{["December 2026","June 2027","December 2027","June 2028"].map(x=><option key={x}>{x}</option>)}</select></label>
            <div className="mm-home-edit-actions"><button type="button" onClick={()=>setEditingProfile(false)}>Cancel</button><button type="button" disabled={savingProfile || !editProfile.name.trim()} onClick={()=>void saveProfile()}>{savingProfile?"Saving…":"Save changes"}</button></div>
          </div> : <><dl><div><dt>Full name</dt><dd>{student.name}</dd></div><div><dt>Email address</dt><dd>{student.email}</dd></div><div><dt>Mobile number</dt><dd>{student.phone || "Not provided"}</dd></div><div><dt>Paper 2 subject</dt><dd>{preferences?.subject_name || "Not selected"}</dd></div><div><dt>Category</dt><dd>{preferences?.category || "Not provided"}</dd></div><div><dt>PwBD</dt><dd>{preferences?.is_pwd ? "Yes" : "No"}</dd></div><div><dt>Qualification goal</dt><dd>{preferences?.qualification_goal || "Not provided"}</dd></div><div><dt>Target exam cycle</dt><dd>{preferences?.target_exam_cycle || "Not provided"}</dd></div></dl><button className="mm-home-modal-close" type="button" onClick={beginEditProfile}>Edit profile</button></>}
          <button className="mm-home-modal-secondary" type="button" onClick={() => setProfileDialogOpen(false)}>Close</button>
        </section>
      </div>}
    </div>
  );
}

function ClipboardIcon() {
  return <BookOpen size={18}/>;
}
