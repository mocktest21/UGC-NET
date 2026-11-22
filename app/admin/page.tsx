"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import MockMasterLoading from "@/app/components/ui/MockMasterLoading";
import "./admin-workspace.css";

type Counts = { questions:number; approved:number; drafts:number; imports:number; tests:number; students:number };
const modules = [
  { title:"Question Bank", description:"Create, classify, review and approve questions.", href:"/admin/questions", icon:"▦", status:"Available" },
  { title:"Excel Imports", description:"Upload workbooks and review staged question rows.", href:"/admin/questions?tab=import", icon:"⇧", status:"Available" },
  { title:"Test Builder", description:"Create practice tests and schedule live examinations.", href:"/admin/tests", icon:"▤", status:"Available" },
  { title:"Student Management", description:"View registrations, profiles and exam preferences.", href:"#", icon:"♙", status:"Coming next" },
  { title:"Analytics & Reports", description:"Monitor attempts, scores and question performance.", href:"#", icon:"⌁", status:"Coming next" },
  { title:"Syllabus Manager", description:"Maintain examinations, papers, subjects and units.", href:"#", icon:"☷", status:"Coming next" },
];

export default function AdminDashboardPage(){
  const router=useRouter();
  const [supabase]=useState(() => (typeof window === "undefined" ? null : createSupabaseBrowserClient()) as ReturnType<typeof createSupabaseBrowserClient>);
  const [loading,setLoading]=useState(true);
  const [isAdmin,setIsAdmin]=useState(false);
  const [adminName,setAdminName]=useState("Administrator");
  const [counts,setCounts]=useState<Counts>({questions:0,approved:0,drafts:0,imports:0,tests:0,students:0});
  const [error,setError]=useState("");
  const [examCycle,setExamCycle]=useState("December 2026");
  const [examDate,setExamDate]=useState("2026-12-15");
  const [examSchedules,setExamSchedules]=useState<{exam_cycle:string;exam_date:string}[]>([]);
  const [savingSchedule,setSavingSchedule]=useState(false);
  const [scheduleMessage,setScheduleMessage]=useState("");

  useEffect(()=>{
    let active=true;
    async function load(){
      const {data,error:authError}=await supabase.auth.getUser();
      if(!active)return;
      if(authError||!data.user){router.replace("/admin/login");return;}
      if(data.user.app_metadata?.role!=="admin"){setIsAdmin(false);setLoading(false);return;}
      setIsAdmin(true);
      const {data:scheduleRows}=await supabase.from("exam_schedule_settings").select("exam_cycle,exam_date").order("exam_cycle");
      if(scheduleRows?.length){setExamSchedules(scheduleRows);const selected=scheduleRows.find(x=>x.exam_cycle==="December 2026")||scheduleRows[0];setExamCycle(selected.exam_cycle);setExamDate(selected.exam_date);}
      const fullName=String(data.user.user_metadata?.full_name||"Administrator");
      setAdminName(fullName.trim().split(/\s+/)[0]||"Administrator");
      const [allQ,approvedQ,draftQ,importsQ,testsQ,studentsQ]=await Promise.all([
        supabase.from("questions").select("id",{count:"exact",head:true}),
        supabase.from("questions").select("id",{count:"exact",head:true}).eq("status","approved"),
        supabase.from("questions").select("id",{count:"exact",head:true}).eq("status","draft"),
        supabase.from("question_import_batches").select("id",{count:"exact",head:true}),
        supabase.from("tests").select("id",{count:"exact",head:true}),
        supabase.from("profiles").select("id",{count:"exact",head:true}),
      ]);
      if(!active)return;
      const failed=[allQ,approvedQ,draftQ,importsQ,testsQ,studentsQ].find(x=>x.error);
      if(failed?.error)setError(failed.error.message);
      setCounts({questions:allQ.count||0,approved:approvedQ.count||0,drafts:draftQ.count||0,imports:importsQ.count||0,tests:testsQ.count||0,students:studentsQ.count||0});
      setLoading(false);
    }
    void load();
    return()=>{active=false;};
  },[router,supabase]);

  async function saveExamSchedule(){
    if(!supabase||!examCycle.trim()||!examDate)return;
    setSavingSchedule(true);setScheduleMessage("");
    const {data:{user}}=await supabase.auth.getUser();
    const {error:saveError}=await supabase.from("exam_schedule_settings").upsert({exam_cycle:examCycle.trim(),exam_date:examDate,updated_at:new Date().toISOString(),updated_by:user?.id||null},{onConflict:"exam_cycle"});
    if(saveError)setScheduleMessage("Could not save exam date: "+saveError.message);
    else {setScheduleMessage("Exam date saved. Student dashboards will use this date.");setExamSchedules(rows=>[...rows.filter(x=>x.exam_cycle!==examCycle.trim()),{exam_cycle:examCycle.trim(),exam_date:examDate}].sort((a,b)=>a.exam_cycle.localeCompare(b.exam_cycle)));}
    setSavingSchedule(false);
  }

  async function signOut(){await supabase.auth.signOut();router.replace("/login");}

  if(loading)return <MockMasterLoading variant="admin" title="Preparing your admin workspace"/>;
  if(!isAdmin)return <main className="aw-state"><section style={{maxWidth:480,margin:"12vh auto",padding:32,background:"#fff",borderRadius:18,textAlign:"center"}}><h1>Administrator access required</h1><p>This workspace is restricted to authorised MockMaster administrators. Sign in with your administrator account to continue.</p><div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:20}}><button onClick={async()=>{await supabase.auth.signOut();router.replace("/admin/login");}}>Go to admin login</button><button onClick={()=>router.replace("/dashboard")}>Return to student dashboard</button></div></section></main>;
  if(error && !counts.questions && !counts.students) { /* Show the workspace with a visible data warning. */ }
  return (
    <main className="aw-shell">
      <aside className="aw-sidebar">
        <a href="/admin" className="aw-brand"><span>M</span><b>MockMaster</b><small>ADMIN</small></a>
        <div className="aw-nav-label">WORKSPACE</div>
        <a className="aw-nav active" href="/admin"><i>⌂</i>Overview</a>
        <div className="aw-nav-label">CONTENT</div>
        <a className="aw-nav" href="/admin/questions"><i>▦</i>Question Bank</a>
        <a className="aw-nav" href="/admin/questions?tab=import"><i>⇧</i>Excel Imports</a>
        <a className="aw-nav" href="/admin/tests"><i>▤</i>Test Builder</a>
        <div className="aw-nav-label">MANAGEMENT</div>
        <a className="aw-nav disabled" aria-disabled="true"><i>♙</i>Students <em>Next</em></a>
        <a className="aw-nav disabled" aria-disabled="true"><i>⌁</i>Analytics <em>Next</em></a>
        <a className="aw-nav disabled" aria-disabled="true"><i>☷</i>Syllabus <em>Next</em></a>
        <div className="aw-sidebar-bottom"><div className="aw-secure"><span>✓</span><div><b>Secure workspace</b><small>Administrator access only</small></div></div><button onClick={signOut}>↪ <span>Sign out</span></button></div>
      </aside>
      <section className="aw-main">
        <header className="aw-topbar"><div><span className="aw-breadcrumb">MockMaster / Admin</span><h1>Admin overview</h1></div><div className="aw-user"><span>{adminName.slice(0,1).toUpperCase()}</span><div><b>{adminName}</b><small>Administrator</small></div></div></header>
        <div className="aw-content">
          <section className="aw-welcome"><div><span>CONTROL CENTRE</span><h2>Welcome back, {adminName}.</h2><p>Manage your question content, imports and examination operations from one place.</p></div><a href="/admin/questions" className="aw-cta">＋ Add question</a></section>
          <section className="aw-exam-schedule">
            <div><span>EXAM OPERATIONS</span><h2>UGC-NET exam countdown</h2><p>Set the exam date shown on student dashboards. If a cycle has no saved date, the system uses the 15th of that month by default.</p></div>
            <div className="aw-exam-schedule-form">
              <label>Exam cycle<input value={examCycle} onChange={e=>setExamCycle(e.target.value)} placeholder="December 2026"/></label>
              <label>Exam date<input type="date" value={examDate} onChange={e=>setExamDate(e.target.value)}/></label>
              <button type="button" onClick={()=>void saveExamSchedule()} disabled={savingSchedule||!examCycle.trim()||!examDate}>{savingSchedule?"Saving…":"Save exam date"}</button>
            </div>
            {scheduleMessage&&<p className="aw-exam-schedule-message" role="status">{scheduleMessage}</p>}
            {examSchedules.length>0&&<div className="aw-exam-schedule-list"><b>Saved exam dates</b>{examSchedules.map(row=><button type="button" key={row.exam_cycle} onClick={()=>{setExamCycle(row.exam_cycle);setExamDate(row.exam_date);setScheduleMessage("");}}><span>{row.exam_cycle}</span><strong>{new Date(row.exam_date+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</strong></button>)}</div>}
          </section>
          {error&&<div className="aw-warning">Some dashboard counts could not be loaded: {error}</div>}
          <div className="aw-section-heading"><div><h2>Platform snapshot</h2><p>Live counts from your MockMaster database.</p></div><span>Updated just now</span></div>
          <section className="aw-stats">
            <article><span className="aw-stat-icon blue">▦</span><div><small>Total questions</small><b>{counts.questions.toLocaleString()}</b><em>Across all subjects</em></div></article>
            <article><span className="aw-stat-icon green">✓</span><div><small>Approved questions</small><b>{counts.approved.toLocaleString()}</b><em>Eligible for practice</em></div></article>
            <article><span className="aw-stat-icon amber">◷</span><div><small>Draft questions</small><b>{counts.drafts.toLocaleString()}</b><em>Awaiting review</em></div></article>
            <article><span className="aw-stat-icon violet">⇧</span><div><small>Import batches</small><b>{counts.imports.toLocaleString()}</b><em>Uploaded workbooks</em></div></article>
            <article><span className="aw-stat-icon slate">▤</span><div><small>Tests created</small><b>{counts.tests.toLocaleString()}</b><em>Practice and live tests</em></div></article>
            <article><span className="aw-stat-icon rose">♙</span><div><small>Registered students</small><b>{counts.students.toLocaleString()}</b><em>Student profiles</em></div></article>
          </section>
          <div className="aw-section-heading aw-modules-heading"><div><h2>Workspace modules</h2><p>Choose an area to manage. Additional modules will be enabled as they are built.</p></div></div>
          <section className="aw-modules">{modules.map((m)=> <article className={m.status==="Available"?"aw-module":"aw-module planned"} key={m.title}><div className="aw-module-top"><span>{m.icon}</span><small className={m.status==="Available"?"ready":""}>{m.status}</small></div><h3>{m.title}</h3><p>{m.description}</p>{m.status==="Available"?<a href={m.href}>Open module <b>→</b></a>:<span className="aw-planned-label">In development</span>}</article>)}</section>
          <footer className="aw-footer">MockMaster Administration <span>Practice. Improve. Achieve.</span></footer>
        </div>
      </section>
    </main>
  );
}
