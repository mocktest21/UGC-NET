"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import "./test-builder.css";

type Taxonomy = { id: string; name: string; code?: string | null };
type Question = {
  id: string; question_type: string; difficulty: string | null; created_at: string;
  prompt: { stem?: { text?: string } } | null; options: Array<{id?:string;text?:string}> | null;
  marks: number; negative_marks: number; subject_name?: string;
};
type SelectedQuestion = Question & { section_title: string; selected_marks: number; selected_negative: number };
type TestRow = { id:string; title:string; mode:string; status:string; duration_seconds:number; total_marks:number; created_at:string };

const fmtDuration = (seconds:number) => {
  const h=Math.floor(seconds/3600), m=Math.floor((seconds%3600)/60);
  return h ? `${h}h ${m}m` : `${m} min`;
};

export default function AdminTestBuilderPage() {
  const router=useRouter();
  const [supabase]=useState(()=>typeof window==="undefined"?null:createSupabaseBrowserClient());\n const db=supabase!;
  const [checking,setChecking]=useState(true);
  const [admin,setAdmin]=useState(false);
  const [tab,setTab]=useState<"builder"|"tests">("builder");
  const [exams,setExams]=useState<Taxonomy[]>([]);
  const [papers,setPapers]=useState<Taxonomy[]>([]);
  const [subjects,setSubjects]=useState<Taxonomy[]>([]);
  const [examId,setExamId]=useState("");
  const [paperId,setPaperId]=useState("");
  const [subjectId,setSubjectId]=useState("");
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [mode,setMode]=useState<"practice"|"live">("practice");
  const [duration,setDuration]=useState("180");
  const [startAt,setStartAt]=useState("");
  const [endAt,setEndAt]=useState("");
  const [maxAttempts,setMaxAttempts]=useState("1");
  const [resultVisibility,setResultVisibility]=useState("after_submission");
  const [shuffleQuestions,setShuffleQuestions]=useState(false);
  const [shuffleOptions,setShuffleOptions]=useState(false);
  const [showSolutions,setShowSolutions]=useState(true);
  const [questions,setQuestions]=useState<Question[]>([]);
  const [selected,setSelected]=useState<SelectedQuestion[]>([]);
  const [search,setSearch]=useState("");
  const [loadingQuestions,setLoadingQuestions]=useState(false);
  const [tests,setTests]=useState<TestRow[]>([]);
  const [loadingTests,setLoadingTests]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    void (async()=>{
      const {data,error}=await db.auth.getUser();
      if(!active)return;
      if(error||!data.user){router.replace("/admin/login");return;}
      if(data.user.app_metadata?.role!=="admin"){setChecking(false);return;}
      setAdmin(true);
      const {data:rows}=await db.from("exams").select("id,name,code").eq("is_active",true).order("display_order");
      if(active){const list=(rows||[]) as Taxonomy[];setExams(list);if(list[0])setExamId(list[0].id);setChecking(false);}
    })();
    return()=>{active=false;};
  },[router,supabase]);

  useEffect(()=>{
    if(!admin||!examId){setPapers([]);return;}
    void (async()=>{const {data}=await db.from("papers").select("id,name,code").eq("exam_id",examId).eq("is_active",true).order("display_order");setPapers((data||[]) as Taxonomy[]);setPaperId("");setSubjectId("");})();
  },[admin,examId,supabase]);

  useEffect(()=>{
    if(!admin||!paperId){setSubjects([]);return;}
    void (async()=>{const {data}=await db.from("subjects").select("id,name,code").eq("paper_id",paperId).eq("is_active",true).order("display_order");setSubjects((data||[]) as Taxonomy[]);setSubjectId("");})();
  },[admin,paperId,supabase]);

  const loadQuestions=useCallback(async()=>{
    if(!admin||!examId||!paperId)return;
    setLoadingQuestions(true);
    const {data:base,error:baseError}=await db.from("questions")
      .select("id,question_type,difficulty,created_at,subject_id")
      .eq("status","approved").eq("exam_id",examId).eq("paper_id",paperId)
      .order("created_at",{ascending:false}).limit(500);
    if(baseError){setError(baseError.message);setLoadingQuestions(false);return;}
    const ids=(base||[]).map((q:any)=>q.id);
    if(!ids.length){setQuestions([]);setLoadingQuestions(false);return;}
    const {data:versions,error:versionError}=await db.from("question_versions")
      .select("question_id,prompt,options,default_marks,default_negative_marks,version_number")
      .in("question_id",ids).order("version_number",{ascending:false});
    if(versionError){setError(versionError.message);setLoadingQuestions(false);return;}
    const latest=new Map<string,any>();
    for(const v of versions||[])if(!latest.has(v.question_id))latest.set(v.question_id,v);
    const subjectNames=new Map(subjects.map(s=>[s.id,s.name]));
    const mapped=(base||[]).flatMap((q:any)=>{
      const v=latest.get(q.id);if(!v)return[];
      return [{...q,prompt:v.prompt,options:v.options,marks:Number(v.default_marks??2),negative_marks:Number(v.default_negative_marks??0),subject_name:subjectNames.get(q.subject_id)||""} as Question];
    });
    setQuestions(mapped);setLoadingQuestions(false);
  },[admin,examId,paperId,subjects,supabase]);

  useEffect(()=>{void loadQuestions();},[loadQuestions]);

  const loadTests=useCallback(async()=>{
    if(!supabase||!admin)return;setLoadingTests(true);
    const {data,error}=await db.from("tests").select("id,title,mode,status,duration_seconds,total_marks,created_at").order("created_at",{ascending:false}).limit(100);
    if(error)setError(error.message);else setTests((data||[]) as TestRow[]);
    setLoadingTests(false);
  },[admin,supabase]);
  useEffect(()=>{void loadTests();},[loadTests]);

  const filtered=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return questions.filter(q=>!term||[q.prompt?.stem?.text||"",q.question_type,q.difficulty||"",q.subject_name||""].join(" ").toLowerCase().includes(term));
  },[questions,search]);
  const selectedIds=new Set(selected.map(q=>q.id));
  const totalMarks=selected.reduce((sum,q)=>sum+q.selected_marks,0);

  function addQuestion(q:Question){if(selectedIds.has(q.id))return;setSelected(old=>[...old,{...q,section_title:"General",selected_marks:q.marks,selected_negative:q.negative_marks}]);}
  function updateSelected(id:string,patch:Partial<SelectedQuestion>){setSelected(old=>old.map(q=>q.id===id?{...q,...patch}:q));}

  async function saveTest(publish:boolean){
    setError("");setMessage("");
    if(!title.trim()){setError("Enter a test title.");return;}
    if(!examId||!paperId){setError("Select an examination and paper.");return;}
    if(selected.length===0){setError("Add at least one approved question.");return;}
    if(mode==="live"&&publish&&(!startAt||!endAt)){setError("Set the live test start and end time before publishing.");return;}
    const durationSeconds=Number(duration)*60;
    if(!Number.isFinite(durationSeconds)||durationSeconds<60){setError("Enter a valid test duration in minutes.");return;}
    setSaving(true);
    const payload={
      title:title.trim(),description:description.trim(),mode,duration_seconds:durationSeconds,
      exam_id:examId,paper_id:paperId,subject_id:subjectId||null,
      starts_at:mode==="live"&&startAt?new Date(startAt).toISOString():null,
      ends_at:mode==="live"&&endAt?new Date(endAt).toISOString():null,
      result_visibility:resultVisibility,max_attempts:maxAttempts?Number(maxAttempts):null,
      shuffle_questions:shuffleQuestions,shuffle_options:shuffleOptions,show_solutions:showSolutions,
      instructions:["Read each question carefully.","Submit your test before the timer ends."]
    };
    const questionPayload=selected.map(q=>({question_id:q.id,section_title:q.section_title||"General",marks:q.selected_marks,negative_marks:q.selected_negative,is_compulsory:true}));
    const {data,error}=await db.rpc("admin_create_test",{p_test:payload,p_questions:questionPayload,p_publish:publish});
    setSaving(false);
    if(error){setError(error.message);return;}
    setMessage(publish?"Test created and published successfully.":"Test saved as draft successfully.");
    setTitle("");setDescription("");setSelected([]);setStartAt("");setEndAt("");setTab("tests");
    await loadTests();
  }

  async function publishTest(id:string){
    setError("");setMessage("");
    const {error}=await db.rpc("admin_publish_test",{p_test_id:id});
    if(error)setError(error.message);else{setMessage("Test published successfully.");await loadTests();}
  }

  if(checking)return <main className="tb-state">Checking administrator access…</main>;
  if(!admin)return <main className="tb-state"><div className="tb-denied"><h1>Administrator access required</h1><p>Sign in using the dedicated administrator login.</p><button onClick={()=>router.replace("/admin/login")}>Admin login</button></div></main>;

  return <main className="tb-shell">
    <header className="tb-header"><a href="/admin" className="tb-brand"><span>M</span> MockMaster <small>ADMIN</small></a><nav><a href="/admin">Overview</a><a href="/admin/questions">Question Bank</a><a className="active" href="/admin/tests">Test Builder</a><button onClick={async()=>{await db.auth.signOut();router.replace("/admin/login");}}>Sign out</button></nav></header>
    <div className="tb-content">
      <div className="tb-heading"><div><span>ASSESSMENT MANAGEMENT</span><h1>Test Builder</h1><p>Create practice tests and schedule live examinations using approved questions.</p></div><button className="tb-primary" onClick={()=>setTab("builder")}>＋ Create test</button></div>
      {message&&<div className="tb-message">{message}</div>}{error&&<div className="tb-error">{error}</div>}
      <div className="tb-tabs"><button className={tab==="builder"?"selected":""} onClick={()=>setTab("builder")}>Create a test</button><button className={tab==="tests"?"selected":""} onClick={()=>setTab("tests")}>Saved tests ({tests.length})</button></div>
      {tab==="builder"?<div className="tb-layout">
        <section className="tb-panel">
          <div className="tb-panel-title"><div><h2>Test details</h2><p>Set the examination, format and test rules.</p></div><span>STEP 1</span></div>
          <label>Test title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. UGC NET Paper 1 Mock Test 01"/></label>
          <label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Brief description for students"/></label>
          <div className="tb-grid2"><label>Examination<select value={examId} onChange={e=>setExamId(e.target.value)}><option value="">Select exam</option>{exams.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Paper<select value={paperId} onChange={e=>setPaperId(e.target.value)}><option value="">Select paper</option>{papers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
          <label>Subject (optional)<select value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">All subjects / paper-wide</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <div className="tb-grid2"><label>Test mode<select value={mode} onChange={e=>setMode(e.target.value as "practice"|"live")}><option value="practice">Practice test</option><option value="live">Live test</option></select></label><label>Duration (minutes)<input type="number" min="1" max="360" value={duration} onChange={e=>setDuration(e.target.value)}/></label></div>
          {mode==="live"&&<div className="tb-grid2"><label>Starts at<input type="datetime-local" value={startAt} onChange={e=>setStartAt(e.target.value)}/></label><label>Ends at<input type="datetime-local" value={endAt} onChange={e=>setEndAt(e.target.value)}/></label></div>}
          <div className="tb-grid2"><label>Maximum attempts<input type="number" min="1" value={maxAttempts} onChange={e=>setMaxAttempts(e.target.value)}/></label><label>Result visibility<select value={resultVisibility} onChange={e=>setResultVisibility(e.target.value)}><option value="after_submission">After submission</option><option value="immediate">Immediate</option><option value="after_window">After test window</option><option value="manual">Manual release</option></select></label></div>
          <div className="tb-checks"><label><input type="checkbox" checked={shuffleQuestions} onChange={e=>setShuffleQuestions(e.target.checked)}/> Shuffle questions</label><label><input type="checkbox" checked={shuffleOptions} onChange={e=>setShuffleOptions(e.target.checked)}/> Shuffle options</label><label><input type="checkbox" checked={showSolutions} onChange={e=>setShowSolutions(e.target.checked)}/> Show solutions</label></div>
        </section>
        <section className="tb-panel tb-question-panel">
          <div className="tb-panel-title"><div><h2>Question selection</h2><p>Only approved questions are available.</p></div><span>STEP 2</span></div>
          <div className="tb-question-summary"><b>{selected.length}</b><span>Questions selected</span><i>{totalMarks.toFixed(2)} marks</i></div>
          <input className="tb-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search question text or type…"/>
          {!paperId?<div className="tb-empty">Select an examination and paper to load approved questions.</div>:loadingQuestions?<div className="tb-empty">Loading approved questions…</div>:filtered.length===0?<div className="tb-empty">No approved questions found for this paper.</div>:
            <div className="tb-question-list">{filtered.map(q=><article key={q.id} className="tb-question-item"><div><small>{q.question_type.replaceAll("_"," ")} · {q.difficulty||"Unrated"}</small><p>{q.prompt?.stem?.text||"Question text unavailable"}</p><span>{q.marks} marks · −{q.negative_marks} negative</span></div><button disabled={selectedIds.has(q.id)} onClick={()=>addQuestion(q)}>{selectedIds.has(q.id)?"Added":"＋ Add"}</button></article>)}</div>}
          <div className="tb-selected"><h3>Selected questions</h3>{selected.length===0?<p className="tb-muted">Your selected questions will appear here.</p>:selected.map((q,i)=><article key={q.id}><div><b>Q{i+1}</b><span>{(q.prompt?.stem?.text||"").slice(0,100)}</span></div><label>Section<input value={q.section_title} onChange={e=>updateSelected(q.id,{section_title:e.target.value})}/></label><label>Marks<input type="number" min="0" step=".25" value={q.selected_marks} onChange={e=>updateSelected(q.id,{selected_marks:Number(e.target.value)})}/></label><label>Negative<input type="number" min="0" step=".25" value={q.selected_negative} onChange={e=>updateSelected(q.id,{selected_negative:Number(e.target.value)})}/></label><button onClick={()=>setSelected(old=>old.filter(x=>x.id!==q.id))}>Remove</button></article>)}</div>
          <div className="tb-total"><span>Total marks</span><b>{totalMarks.toFixed(2)}</b></div>
          <div className="tb-actions"><button disabled={saving} onClick={()=>void saveTest(false)}>{saving?"Saving…":"Save as draft"}</button><button className="tb-primary" disabled={saving} onClick={()=>void saveTest(true)}>{saving?"Publishing…":"Publish test"}</button></div>
        </section>
      </div>:<section className="tb-panel tb-saved"><div className="tb-panel-title"><div><h2>Saved tests</h2><p>Manage drafts and published tests.</p></div><button className="tb-secondary" onClick={()=>void loadTests()}>Refresh</button></div>{loadingTests?<div className="tb-empty">Loading tests…</div>:tests.length===0?<div className="tb-empty">No tests created yet. Start by creating your first test.</div>:<div className="tb-table-wrap"><table><thead><tr><th>Test</th><th>Mode</th><th>Duration</th><th>Marks</th><th>Status</th><th>Action</th></tr></thead><tbody>{tests.map(t=><tr key={t.id}><td><b>{t.title}</b><small>{new Date(t.created_at).toLocaleDateString()}</small></td><td>{t.mode}</td><td>{fmtDuration(t.duration_seconds)}</td><td>{Number(t.total_marks).toFixed(2)}</td><td><span className={t.status==="published"?"tb-status published":"tb-status"}>{t.status}</span></td><td>{t.status==="draft"?<button className="tb-publish" onClick={()=>void publishTest(t.id)}>Publish</button>:<span className="tb-muted">Live</span>}</td></tr>)}</tbody></table></div>}</section>}
      <footer className="tb-footer">MockMaster · Test Builder <span>Practice. Improve. Achieve.</span></footer>
    </div>
  </main>;
}
