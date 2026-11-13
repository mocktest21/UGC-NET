"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import "./build-test.css";

type Row={id:string;name:string;code?:string|null;unit_number?:number|null};
type PaperCount={id:string;name:string;count:number};
export default function StudentBuildTestPage(){
 const router=useRouter();
 const [supabase]=useState(()=>typeof window==="undefined"?null:createSupabaseBrowserClient());
 const db=supabase!;
 const [loading,setLoading]=useState(true);
 const [examId,setExamId]=useState("");
 const [papers,setPapers]=useState<Row[]>([]);
 const [paperId,setPaperId]=useState("");
 const [subjects,setSubjects]=useState<Row[]>([]);
 const [subjectId,setSubjectId]=useState("");
 const [units,setUnits]=useState<Row[]>([]);
 const [unitCounts,setUnitCounts]=useState<Record<string,number>>({});
 const [unitCounts,setUnitCounts]=useState<Record<string,number>>({});
 const [unitId,setUnitId]=useState("all");
 const [count,setCount]=useState(50);
 const [minutes,setMinutes]=useState(50);
 const [pool,setPool]=useState<PaperCount[]>([]);
 const [available,setAvailable]=useState(0);
 const [error,setError]=useState("");
 const [language,setLanguage]=useState("en");
 const [source,setSource]=useState("all");
 const [busy,setBusy]=useState(false);

 useEffect(()=>{if(!supabase)return;let live=true;(async()=>{
  const {data,error}=await db.auth.getUser();if(error||!data.user){router.replace("/login");return;}
  const {data:exam}=await db.from("exams").select("id").eq("code","UGC_NET").eq("is_active",true).maybeSingle();
  if(!exam){if(live)setLoading(false);return;}setExamId(exam.id);
  const {data:paperRows}=await db.from("papers").select("id,name,code").eq("exam_id",exam.id).eq("is_active",true).order("display_order");
  const {data:preference}=await db.from("student_exam_preferences").select("selected_subject_id").eq("student_id",data.user.id).eq("exam_id",exam.id).maybeSingle();
  const preferred=window.sessionStorage.getItem("mm-practice-subject")||preference?.selected_subject_id||"";
  const preferredPaperId=window.sessionStorage.getItem("mm-practice-paper")||"";
  let preferredSubject:any=null;
  if(preferred){const {data:subject}=await db.from("subjects").select("id,paper_id").eq("id",preferred).maybeSingle();preferredSubject=subject;}
  const allowed=(paperRows||[]).filter((p:any)=>/paper\s*1|common/i.test(p.name+" "+p.code)||(preferredSubject&&p.id===preferredSubject.paper_id));
  if(live){setPapers(allowed as Row[]);if(preferredSubject&&(!preferredPaperId||preferredPaperId===preferredSubject.paper_id)){setPaperId(preferredSubject.paper_id);setSubjectId(preferredSubject.id);window.sessionStorage.setItem("mm-practice-subject",preferredSubject.id);}else if(preferredPaperId&&allowed.some((p:any)=>p.id===preferredPaperId)){setPaperId(preferredPaperId);window.sessionStorage.removeItem("mm-practice-subject");}else if(allowed[0])setPaperId(allowed[0].id);window.sessionStorage.removeItem("mm-practice-paper");}
  if(live)setLoading(false);
 })();return()=>{live=false;};},[router,supabase]);

 useEffect(()=>{if(!supabase||!paperId){setSubjects([]);setSubjectId("");return;}void(async()=>{
  const {data}=await db.from("subjects").select("id,name,code").eq("paper_id",paperId).eq("is_active",true).order("display_order");
  const preferred=window.sessionStorage.getItem("mm-practice-subject")||preference?.selected_subject_id||"";
  const preferredPaperId=window.sessionStorage.getItem("mm-practice-paper")||"";
 })();},[paperId,supabase]);
 useEffect(()=>{if(!supabase||!subjectId){setUnits([]);setUnitId("all");return;}void(async()=>{
  const {data}=await db.from("units").select("id,name,unit_number").eq("subject_id",subjectId).eq("is_active",true).order("display_order");
  setUnits((data||[]) as Row[]);setUnitId("all");
 })();},[subjectId,supabase]);

 useEffect(()=>{if(!supabase||!examId||!papers.length)return;let live=true;void(async()=>{
  const rows:PaperCount[]=[];
  for(const p of papers){const {count}=await db.from("questions").select("id",{count:"exact",head:true}).eq("exam_id",examId).eq("paper_id",p.id).eq("status","approved");rows.push({id:p.id,name:p.name,count:count||0});}
  if(live)setPool(rows);
 })();return()=>{live=false;};},[examId,papers,supabase]);

 useEffect(()=>{if(!supabase||!subjectId||!units.length)return;let live=true;void(async()=>{
  const counts:Record<string,number>={};
  for(const unit of units){let q=db.from("questions").select("id",{count:"exact",head:true}).eq("exam_id",examId).eq("paper_id",paperId).eq("subject_id",subjectId).eq("unit_id",unit.id).eq("status","approved");if(language)q=q.eq("language_code",language);if(source==="pyq")q=q.eq("source_type","previous_year");if(source==="expected")q=q.eq("source_type","admin_created");const {count}=await q;counts[unit.id]=count||0;}
  if(live)setUnitCounts(counts);
 })();return()=>{live=false;};},[supabase,examId,paperId,subjectId,units,language,source]);

 useEffect(()=>{if(!supabase||!examId||!paperId)return;let live=true;void(async()=>{
  let q=db.from("questions").select("id",{count:"exact",head:true}).eq("exam_id",examId).eq("paper_id",paperId).eq("status","approved");
  if(subjectId)q=q.eq("subject_id",subjectId);
  if(unitId!=="all")q=q.eq("unit_id",unitId);
  if(language)q=q.eq("language_code",language);
  if(source==="pyq")q=q.eq("source_type","previous_year");
  if(source==="expected")q=q.eq("source_type","admin_created");
  const {count,error}=await q;if(live){setAvailable(count||0);if(error)setError(error.message);}
 })();return()=>{live=false;};},[examId,paperId,subjectId,unitId,language,source,supabase]);

 const selectedPaper=papers.find(p=>p.id===paperId);
 const selectedSubject=subjects.find(s=>s.id===subjectId);
 const selectedUnit=units.find(u=>u.id===unitId);
 const actualCount=Math.min(count,available);
 const canStart=!!paperId&&available>0&&actualCount>0&&minutes>0;
 const summary=useMemo(()=>({paper:selectedPaper?.name||"Select a paper",subject:selectedSubject?.name||"All subjects",unit:unitId==="all"?"All units":selectedUnit?.name||"Selected unit"}),[selectedPaper,selectedSubject,selectedUnit,unitId]);
 async function start(){
  if(!canStart||!supabase)return;setBusy(true);setError("");
  const {data,error}=await db.rpc("student_start_practice_test",{
   p_exam_id:examId,p_paper_id:paperId,p_subject_id:subjectId||null,
   p_unit_id:unitId==="all"?null:unitId,p_question_count:actualCount,
   p_duration_seconds:minutes*60,p_language_code:language,p_source:source
  });
  if(error){setError(error.message);setBusy(false);return;}
  const result=data as {test_id:string;attempt_id:string;question_count:number};
  const params=new URLSearchParams({test:result.test_id,attempt:result.attempt_id,minutes:String(minutes)});
  router.push("/practice/session?"+params.toString());
 }
 if(loading)return <main className="sb-state">Loading your practice builder…</main>;
 return <main className="sb-page">
  <header className="sb-header"><a className="sb-brand" href="/dashboard"><span>M</span>MockMaster</a><nav><a href="/dashboard">Dashboard</a><a className="active" href="/practice">Practice</a><a href="/live-test">Live Test</a><a href="/personal-notebook">My Stuff</a></nav><a className="sb-account" href="/dashboard">My Dashboard ↗</a></header>
  <div className="sb-layout"><section className="sb-main">
   <div className="sb-title"><div><span>PERSONALISED PRACTICE</span><h1>Build your test</h1><p>Choose your paper, subject, units, question count and time. Your practice set is tailored to your selection.</p></div><span className="sb-exam">UGC NET ▾</span></div>
   <div className="sb-rule"/>
   <div className="sb-fields">
    <section className="sb-field"><label>Paper</label><div className="sb-choice-grid">{papers.map(p=><button key={p.id} className={paperId===p.id?"chosen":""} onClick={()=>{setPaperId(p.id);setSubjectId("");}}><b>{p.name}</b><small>{(pool.find(x=>x.id===p.id)?.count??0).toLocaleString("en-IN")} approved questions</small><span>{paperId===p.id?"✓ Selected":"Choose →"}</span></button>)}</div></section>
    <section className="sb-field"><label>Subject</label><select value={subjectId} onChange={e=>setSubjectId(e.target.value)} disabled={!paperId}><option value="">All subjects in selected paper</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><p>For Paper 2, choose your subject. Paper 1 includes the common syllabus.</p></section>
    <section className="sb-field"><div className="sb-label-row"><label>Units</label><span>{units.length} available</span></div><div className="sb-unit-options"><button className={unitId==="all"?"chosen":""} onClick={()=>setUnitId("all")} disabled={!subjectId}>All units</button>{units.map(u=><button key={u.id} className={unitId===u.id?"chosen":""} onClick={()=>setUnitId(u.id)}>{u.name} <small>{(unitCounts[u.id]??0).toLocaleString("en-IN")} questions</small></button>)}</div><p>{unitId==="all"?"Questions can be drawn from every unit in this subject.":selectedUnit?.name+" · "+(unitCounts[unitId]??0).toLocaleString("en-IN")+" approved questions available"}</p><p className="sb-live-release-note">Questions used in a scheduled Live Test join the Practice pool automatically after that test window closes. Unseen questions are selected first.</p></section>
    <div className="sb-two-col"><section className="sb-field"><label>Question source</label><div className="sb-pills"><button className={source==="all"?"chosen":""} onClick={()=>setSource("all")}>All</button><button className={source==="pyq"?"chosen":""} onClick={()=>setSource("pyq")}>PYQ only</button><button className={source==="expected"?"chosen":""} onClick={()=>setSource("expected")}>Expected only</button></div></section><section className="sb-field"><label>Language</label><div className="sb-pills"><button className={language==="hi"?"chosen":""} onClick={()=>setLanguage("hi")}>हिन्दी</button><button className={language==="en"?"chosen":""} onClick={()=>setLanguage("en")}>English</button></div></section></div>
    <section className="sb-field"><div className="sb-label-row"><label>Number of questions</label><span>{available.toLocaleString("en-IN")} available</span></div><div className="sb-count-options">{[10,25,50,100].map(n=><button key={n} className={count===n?"chosen":""} onClick={()=>setCount(n)}>{n}</button>)}<button className={count===available?"chosen":""} onClick={()=>setCount(Math.max(1,available))} disabled={!available}>All available</button></div>{available>0&&count>available&&<p className="sb-warning">Only {available} questions match your filters. Your test will use {available}.</p>}</section>
    <section className="sb-field"><div className="sb-label-row"><label>Time limit</label><span>Minutes</span></div><div className="sb-count-options">{[10,25,50,90,120,180].map(n=><button key={n} className={minutes===n?"chosen":""} onClick={()=>setMinutes(n)}>{n} min</button>)}</div><div className="sb-custom-time"><label htmlFor="custom-time">Custom time</label><input id="custom-time" type="number" min="1" max="360" value={minutes} onChange={e=>setMinutes(Math.max(1,Math.min(360,Number(e.target.value)||1)))}/><span>minutes</span></div></section>
   </div>
  </section><aside className="sb-side"><div className="sb-summary"><h2>Your test</h2><div><span>Paper</span><b>{summary.paper}</b></div><div><span>Subject</span><b>{summary.subject}</b></div><div><span>Units</span><b>{summary.unit}</b></div><div><span>Source</span><b>{source==="all"?"All questions":source==="pyq"?"PYQ only":"Expected only"}</b></div><div><span>Language</span><b>{language==="en"?"English":"हिन्दी"}</b></div><div><span>Questions</span><b>{actualCount}</b></div><div><span>Time limit</span><b>{minutes} min</b></div><div className="sb-summary-note">{available===0?"No approved questions match this selection yet.":actualCount+" questions selected from "+available.toLocaleString("en-IN")+" available questions."}</div>{error&&<p className="sb-error">{error}</p>}<button className="sb-start" disabled={!canStart||busy} onClick={()=>void start()}>{busy?"Preparing…":"Start test →"}</button><small className="sb-footnote">You can change your selection before starting.</small></div><div className="sb-side-tip"><b>Practice smarter</b><p>Start with one unit, review your performance, then expand to a full-paper practice set.</p></div></aside></div>
 </main>;
}
