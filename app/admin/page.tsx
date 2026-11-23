"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
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
  { title:"Syllabus Manager", description:"Maintain examinations, papers, subjects, units and topics.", href:"/admin/syllabus", icon:"☷", status:"Available" },
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
  const [examDate,setExamDate]=useState("");
  const [examSchedules,setExamSchedules]=useState<{exam_cycle:string;exam_date:string;subject_id:string;subject_code:string|null;subject_name:string}[]>([]);
  const [scheduleSubjects,setScheduleSubjects]=useState<{id:string;code:string|null;name:string}[]>([]);
  const [scheduleSubjectId,setScheduleSubjectId]=useState("");
  const [scheduleFile,setScheduleFile]=useState<File|null>(null);
  const [schedulePreview,setSchedulePreview]=useState<{exam_cycle:string;subject_code:string;subject_name:string;exam_date:string;error?:string}[]>([]);
  const [importingSchedule,setImportingSchedule]=useState(false);
  const [scheduleImportSummary,setScheduleImportSummary]=useState("");
  const scheduleFileRef=useRef<HTMLInputElement>(null);
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
      const [{data:scheduleRows},{data:subjectRows}] = await Promise.all([
        supabase.from("subject_exam_schedules").select("exam_cycle,exam_date,subject_id,subjects(code,name)").order("exam_cycle"),
        supabase.from("subjects").select("id,code,name,papers!inner(code)").eq("papers.code","PAPER_2").eq("is_active",true).order("display_order")
      ]);
      const normalizedSchedules=(scheduleRows||[]).map((row:any)=>({exam_cycle:row.exam_cycle,exam_date:row.exam_date,subject_id:row.subject_id,subject_code:row.subjects?.code??null,subject_name:row.subjects?.name||"Unknown subject"}));
      setExamSchedules(normalizedSchedules);setScheduleSubjects(subjectRows||[]);
      if(subjectRows?.length)setScheduleSubjectId(subjectRows[0].id);
      if(normalizedSchedules.length){const selected=normalizedSchedules.find((x:any)=>x.exam_cycle==="December 2026")||normalizedSchedules[0];setExamCycle(selected.exam_cycle);setExamDate(selected.exam_date);setScheduleSubjectId(selected.subject_id);}
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
    if(!supabase||!examCycle.trim()||!examDate||!scheduleSubjectId)return;
    setSavingSchedule(true);setScheduleMessage("");
    const {data:{user}}=await supabase.auth.getUser();
    const {error:saveError}=await supabase.from("subject_exam_schedules").upsert({exam_cycle:examCycle.trim(),subject_id:scheduleSubjectId,exam_date:examDate,updated_at:new Date().toISOString(),updated_by:user?.id||null},{onConflict:"exam_cycle,subject_id"});
    if(saveError)setScheduleMessage("Could not save subject exam date: "+saveError.message);
    else {setScheduleMessage("Paper 2 subject date saved. Matching students' countdowns will use this date.");const subject=scheduleSubjects.find(x=>x.id===scheduleSubjectId);setExamSchedules(rows=>[...rows.filter(x=>!(x.exam_cycle===examCycle.trim()&&x.subject_id===scheduleSubjectId)),{exam_cycle:examCycle.trim(),exam_date:examDate,subject_id:scheduleSubjectId,subject_code:subject?.code||null,subject_name:subject?.name||"Subject"}].sort((x,y)=>x.exam_cycle.localeCompare(y.exam_cycle)||x.subject_name.localeCompare(y.subject_name)));}
    setSavingSchedule(false);
  }
  function downloadScheduleTemplate(){
    const ws=XLSX.utils.json_to_sheet([{exam_cycle:"December 2026",subject_code:"008",subject_name:"Commerce",exam_date:"2026-12-16"},{exam_cycle:"December 2026",subject_code:"017",subject_name:"Management",exam_date:"2026-12-18"}]);
    ws["!cols"]=[{wch:20},{wch:16},{wch:22},{wch:16}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Subject Exam Dates");XLSX.writeFile(wb,"MockMaster_Subject_Exam_Schedule_Template.xlsx");
  }
  async function previewScheduleFile(file:File|null){
    setScheduleFile(file);setSchedulePreview([]);setScheduleImportSummary("");if(!file)return;
    try{const workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});const sheet=workbook.Sheets[workbook.SheetNames[0]];const raw=XLSX.utils.sheet_to_json<Record<string,any>>(sheet,{defval:""});
      setSchedulePreview(raw.map(row=>{const norm=(v:any)=>String(v??"").trim();let date="";const v=row.exam_date;if(v instanceof Date&&!Number.isNaN(v.getTime()))date=v.toISOString().slice(0,10);else if(typeof v==="number"){const parsed=XLSX.SSF.parse_date_code(v);if(parsed)date=`${parsed.y}-${String(parsed.m).padStart(2,"0")}-${String(parsed.d).padStart(2,"0")}`;}else date=norm(v);const cycle=norm(row.exam_cycle),code=norm(row.subject_code),name=norm(row.subject_name);const validDate=/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+"T00:00:00"));const errors=[!cycle?"Missing exam_cycle":null,!code?"Missing subject_code":null,!name?"Missing subject_name":null,!validDate?"exam_date must be YYYY-MM-DD":null].filter(Boolean);return {exam_cycle:cycle,subject_code:code,subject_name:name,exam_date:date,error:errors.join("; ")||undefined};}));
    }catch(e:any){setScheduleImportSummary("Could not read workbook: "+(e?.message||"Invalid Excel file."));}
  }
  async function importScheduleWorkbook(){
    if(!supabase||!schedulePreview.length)return;setImportingSchedule(true);setScheduleImportSummary("");
    try{const {data:{user}}=await supabase.auth.getUser();const valid=schedulePreview.filter(x=>!x.error);const invalid=schedulePreview.length-valid.length;const codes=[...new Set(valid.map(x=>x.subject_code))];
      const {data:subjects,error:subjectError}=await supabase.from("subjects").select("id,code,name,papers!inner(code)").eq("papers.code","PAPER_2").in("code",codes);if(subjectError)throw subjectError;
      const byCode=new Map((subjects||[]).map((s:any)=>[String(s.code),s]));const payload:any[]=[];let unmatched=0;
      for(const row of valid){const subject=byCode.get(row.subject_code) as any;if(!subject||subject.name.trim().toLowerCase()!==row.subject_name.trim().toLowerCase()){unmatched++;continue;}payload.push({exam_cycle:row.exam_cycle,subject_id:subject.id,exam_date:row.exam_date,updated_at:new Date().toISOString(),updated_by:user?.id||null});}
      const deduped=new Map<string,any>();payload.forEach(x=>deduped.set(x.exam_cycle+"|"+x.subject_id,x));const records=[...deduped.values()];let saved=0;
      for(let i=0;i<records.length;i+=100){const {error}=await supabase.from("subject_exam_schedules").upsert(records.slice(i,i+100),{onConflict:"exam_cycle,subject_id"});if(error)throw error;saved+=records.slice(i,i+100).length;}
      const {data:latest}=await supabase.from("subject_exam_schedules").select("exam_cycle,exam_date,subject_id,subjects(code,name)").order("exam_cycle");
      setExamSchedules((latest||[]).map((row:any)=>({exam_cycle:row.exam_cycle,exam_date:row.exam_date,subject_id:row.subject_id,subject_code:row.subjects?.code??null,subject_name:row.subjects?.name||"Unknown subject"})));
      setScheduleImportSummary(`Imported/updated ${saved} subject dates. Invalid rows: ${invalid}. Subject code/name mismatches: ${unmatched}. Duplicate cycle-subject rows consolidated (last row wins).`);setSchedulePreview([]);setScheduleFile(null);if(scheduleFileRef.current)scheduleFileRef.current.value="";
    }catch(e:any){setScheduleImportSummary("Import failed: "+(e?.message||"Please check the workbook."));}finally{setImportingSchedule(false);}
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
        <a className="aw-nav" href="/admin/syllabus"><i>☷</i>Syllabus Manager</a>
        <div className="aw-sidebar-bottom"><div className="aw-secure"><span>✓</span><div><b>Secure workspace</b><small>Administrator access only</small></div></div><button onClick={signOut}>↪ <span>Sign out</span></button></div>
      </aside>
      <section className="aw-main">
        <header className="aw-topbar"><div><span className="aw-breadcrumb">MockMaster / Admin</span><h1>Admin overview</h1></div><div className="aw-user"><span>{adminName.slice(0,1).toUpperCase()}</span><div><b>{adminName}</b><small>Administrator</small></div></div></header>
        <div className="aw-content">
          <section className="aw-welcome"><div><span>CONTROL CENTRE</span><h2>Welcome back, {adminName}.</h2><p>Manage your question content, imports and examination operations from one place.</p></div><a href="/admin/questions" className="aw-cta">＋ Add question</a></section>
          <section className="aw-exam-schedule">
            <div><span>EXAM OPERATIONS</span><h2>Paper 2 subject-wise exam dates</h2><p>Countdown is based only on the student's selected Paper 2 subject. Paper 1 has no role in the countdown. Manage dates manually or upload Excel.</p></div>
            <div className="aw-exam-schedule-form">
              <label>Exam cycle<input value={examCycle} onChange={e=>setExamCycle(e.target.value)} placeholder="December 2026"/></label>
              <label>Paper 2 subject<select value={scheduleSubjectId} onChange={e=>setScheduleSubjectId(e.target.value)}><option value="">Select subject</option>{scheduleSubjects.map(s=><option key={s.id} value={s.id}>{s.name} ({s.code||"No code"})</option>)}</select></label>
              <label>Exam date<input type="date" value={examDate} onChange={e=>setExamDate(e.target.value)}/></label>
              <button type="button" onClick={()=>void saveExamSchedule()} disabled={savingSchedule||!examCycle.trim()||!examDate||!scheduleSubjectId}>{savingSchedule?"Saving…":"Save subject date"}</button>
            </div>
            <div className="aw-schedule-import"><div><b>Bulk upload subject dates</b><p>Required columns: <code>exam_cycle</code>, <code>subject_code</code>, <code>subject_name</code>, <code>exam_date</code>. One row per subject and date. Date format: YYYY-MM-DD.</p></div><div className="aw-schedule-import-actions"><button type="button" className="aw-schedule-secondary" onClick={downloadScheduleTemplate}>Download Excel template</button><label className="aw-schedule-upload">Choose Excel file<input ref={scheduleFileRef} type="file" accept=".xlsx,.xls" onChange={e=>void previewScheduleFile(e.target.files?.[0]||null)}/></label></div></div>
            {scheduleFile&&<div className="aw-schedule-preview"><b>Preview: {scheduleFile.name}</b><div className="aw-schedule-table-wrap"><table><thead><tr><th>Cycle</th><th>Subject code</th><th>Subject</th><th>Date</th><th>Validation</th></tr></thead><tbody>{schedulePreview.slice(0,100).map((r,i)=><tr key={i}><td>{r.exam_cycle}</td><td>{r.subject_code}</td><td>{r.subject_name}</td><td>{r.exam_date}</td><td className={r.error?"bad":"good"}>{r.error||"Valid"}</td></tr>)}</tbody></table></div><small>Showing up to 100 of {schedulePreview.length} rows.</small><button type="button" onClick={()=>void importScheduleWorkbook()} disabled={importingSchedule||!schedulePreview.length||schedulePreview.every(x=>x.error)}>{importingSchedule?"Importing…":"Import valid rows"}</button></div>}
            {scheduleMessage&&<p className="aw-exam-schedule-message" role="status">{scheduleMessage}</p>}{scheduleImportSummary&&<p className="aw-exam-schedule-message" role="status">{scheduleImportSummary}</p>}
            {examSchedules.length>0&&<div className="aw-exam-schedule-list"><b>Saved Paper 2 dates</b>{examSchedules.map(row=><button type="button" key={row.exam_cycle+"-"+row.subject_id} onClick={()=>{setExamCycle(row.exam_cycle);setExamDate(row.exam_date);setScheduleSubjectId(row.subject_id);setScheduleMessage("");}}><span>{row.exam_cycle} · {row.subject_name}</span><strong>{new Date(row.exam_date+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</strong></button>)}</div>}
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
