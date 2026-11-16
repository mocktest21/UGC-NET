"use client";

import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import "./result.css";
import StudentWorkspaceHeader from "@/components/navigation/StudentWorkspaceHeader";

type Attempt={id:string;test_id:string;attempt_number:number;score:number|null;max_score:number|null;accuracy:number|null;correct_count:number;incorrect_count:number;unanswered_count:number;questions_attempted:number;time_taken_seconds:number|null;submitted_at:string|null};
type Q={question_id:string;bank_question_id?:string;position:number;question_type:string;prompt:any;stimulus:any;options:any[];explanation:any;response:any;is_correct:boolean|null;awarded_marks:number;marks:number;negative_marks:number;answer_key:any};
type ResultData={attempt:Attempt;test:{id:string;title:string;mode:string;show_solutions:boolean;source_live_test_id:string|null};questions:Q[];history:Attempt[]};
const textOf=(v:any)=>typeof v==="string"?v:(v?.text||v?.stem?.text||v?.content||"");
const answerOf=(key:any)=>key?.correct_option_id??key?.correct_option_ids??key?.correct_answer??key?.answer??key;
const formatTime=(s:number|null)=>{if(s===null)return "—";const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;return h? h+"h "+m+"m":m+"m "+sec+"s";};
const responseText=(v:any,options:any[])=>{
 if(v===null||v===undefined)return "Not attempted";
 const vals=Array.isArray(v)?v:[v];
 return vals.map(x=>{const opt=options.find((o:any)=>String(o.id??o.value??"")===String(x));return opt?String(opt.text??opt.label??x):typeof x==="object"?JSON.stringify(x):String(x)}).join(", ");
};
export default function PracticeResultPage(){
 const router=useRouter();
 const [attemptId,setAttemptId]=useState("");
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get("attempt")||"";setAttemptId(id);if(!id){setError("Attempt reference is missing. Open a completed test from your dashboard to view its result.");setLoading(false);}},[]);
 const [data,setData]=useState<ResultData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false),[showAnalysis,setShowAnalysis]=useState(true),[studentId,setStudentId]=useState(""),[bookmarked,setBookmarked]=useState<string[]>([]);
 const load=useCallback(async()=>{if(!attemptId)return;const db=createSupabaseBrowserClient();const {data:auth,error:authError}=await db.auth.getUser();if(authError){setError("Unable to verify your session. Please retry.");setLoading(false);return;}if(!auth.user){router.replace("/login");return;}setStudentId(auth.user.id);const {data,error}=await db.rpc("student_get_attempt_result",{p_attempt_id:attemptId});if(error){setError(error.message);setLoading(false);return;}const result=data as ResultData;const {data:links,error:linksError}=await db.from("test_questions").select("id,question_id").eq("test_id",result.attempt.test_id);if(linksError){setError("Question links could not be loaded: "+linksError.message);setLoading(false);return;}const bankIdByLink=new Map((links||[]).map((x:any)=>[x.id,x.question_id]));const questionIds=Array.from(new Set((links||[]).map((x:any)=>x.question_id).filter(Boolean)));if(auth.user&&questionIds.length){const {data:saved,error:savedError}=await db.from("bookmarks").select("question_id").eq("student_id",auth.user.id).in("question_id",questionIds);if(savedError){setError("Bookmarks could not be loaded: "+savedError.message);setLoading(false);return;}setBookmarked((saved||[]).map((x:any)=>x.question_id));}result.questions=result.questions.map((q:any)=>({...q,bank_question_id:bankIdByLink.get(q.question_id)}));setData(result);setLoading(false);},[attemptId]);
 useEffect(()=>{if(attemptId)void load();},[attemptId,load]);
 const toggleBookmark=async(questionId:string)=>{if(!studentId)return;const exists=bookmarked.includes(questionId);setBookmarked(old=>exists?old.filter(x=>x!==questionId):[...old,questionId]);const db=createSupabaseBrowserClient();const result=exists?await db.from("bookmarks").delete().eq("student_id",studentId).eq("question_id",questionId):await db.from("bookmarks").insert({student_id:studentId,question_id:questionId});if(result.error){setBookmarked(old=>exists?[...old,questionId]:old.filter(x=>x!==questionId));setError(result.error.message);}};
 const reattempt=async()=>{if(!data)return;setBusy(true);setError("");const db=createSupabaseBrowserClient();const {data:next,error}=await db.rpc("student_reattempt_test",{p_attempt_id:data.attempt.id});setBusy(false);if(error){setError(error.message);return;}const n=next as {test_id:string;attempt_id:string;duration_seconds:number};router.push("/practice/session?"+new URLSearchParams({test:n.test_id,attempt:n.attempt_id,minutes:String(Math.ceil(n.duration_seconds/60))}));};
 if(loading)return <main className="mr-state">Preparing your result…</main>;
 if(error&&!data)return <main className="mr-state"><div><h2>Result unavailable</h2><p>{error}</p><button onClick={()=>router.push("/dashboard")}>Go to dashboard</button></div></main>;
 if(!data)return null;
 const a=data.attempt,score=Number(a.score??0),max=Number(a.max_score??0),pct=max>0?Math.max(0,Math.min(100,score/max*100)):0;
 const history=data.history||[];
 return <main className="mr-shell">
  <StudentWorkspaceHeader/>
  <section className="mr-content">
   <div className="mr-heading"><span>ATTEMPT {a.attempt_number} · SUBMITTED {a.submitted_at?new Date(a.submitted_at).toLocaleString("en-IN"):""}</span><h1>Your test result</h1><p>Review your performance and identify what to improve next.</p></div>
   <section className="mr-score-card"><div className="mr-score-main"><small>YOUR SCORE</small><strong>{score.toFixed(2)} <i>/ {max.toFixed(2)}</i></strong><span>{pct.toFixed(1)}% of maximum marks</span></div><div className="mr-score-ring" style={{"--score":pct+"%"} as React.CSSProperties}><b>{Number(a.accuracy??0).toFixed(1)}%</b><small>Accuracy</small></div></section>
   <section className="mr-stat-grid">
    <article><span className="correct">✓</span><b>{a.correct_count}</b><small>Correct</small></article>
    <article><span className="incorrect">×</span><b>{a.incorrect_count}</b><small>Incorrect</small></article>
    <article><span className="unattempted">—</span><b>{a.unanswered_count}</b><small>Unattempted</small></article>
    <article><span className="time">◷</span><b>{formatTime(a.time_taken_seconds)}</b><small>Time taken</small></article>
   </section>
   {error&&<p className="mr-error">{error}</p>}
   <section className="mr-panel"><div className="mr-panel-heading"><div><span>QUESTION REVIEW</span><h2>Detailed analysis</h2><p>Check your response against the answer key.</p></div><button onClick={()=>setShowAnalysis(v=>!v)}>{showAnalysis?"Hide":"Show"} analysis</button></div>
    {showAnalysis&&<div className="mr-question-list">{data.questions.map((q,i)=>{const correct=q.is_correct===true;const blank=q.response===null||q.response===undefined||q.response==="";const answer=answerOf(q.answer_key);const explanation=textOf(q.explanation);return <article className="mr-question" key={q.question_id}>
      <div className="mr-question-top"><b>Question {i+1}</b><span className={blank?"neutral":correct?"good":"bad"}>{blank?"Unattempted":correct?"Correct":"Incorrect"}</span><small>{Number(q.awarded_marks??0)>=0?"+":""}{Number(q.awarded_marks??0).toFixed(2)} marks</small>{q.bank_question_id&&<button type="button" className="mr-bookmark-button" onClick={()=>void toggleBookmark(q.bank_question_id!)}>{bookmarked.includes(q.bank_question_id)?"★ Bookmarked":"☆ Bookmark"}</button>}</div>
      <h3>{textOf(q.prompt)||"Question text unavailable"}</h3>
      {q.stimulus&&<p className="mr-stimulus">{textOf(q.stimulus)}</p>}
      {Array.isArray(q.options)&&q.options.length>0&&<div className="mr-options">{q.options.map((o:any,j:number)=>{const id=String(o.id??o.value??j);const chosen=Array.isArray(q.response)?q.response.map(String).includes(id):String(q.response)===id;const keyValue=Array.isArray(answer)?answer.map(String).includes(id):String(answer)===id;return <div key={id} className={(keyValue?"key ":"")+(chosen&&!keyValue?"wrong-choice":"")}><b>{String.fromCharCode(65+j)}.</b><span>{String(o.text??o.label??o.value??"")}</span>{keyValue&&<em>Correct answer</em>}{chosen&&!keyValue&&<em>Your answer</em>}</div>})}</div>}
      <div className="mr-response-row"><span>Your response</span><b>{responseText(q.response,q.options||[])}</b></div>
      <div className="mr-response-row answer"><span>Correct answer</span><b>{responseText(answer,q.options||[])}</b></div>
      {data.test.show_solutions&&explanation&&<div className="mr-explanation"><b>Explanation</b><p>{explanation}</p></div>}
    </article>})}</div>}
   </section>
   <section className="mr-panel"><div className="mr-panel-heading"><div><span>YOUR PROGRESS</span><h2>Attempt history</h2><p>Compare your previous attempts for this test.</p></div></div>
    {history.length>0?<div className="mr-history-wrap"><table className="mr-history"><thead><tr><th>Attempt</th><th>Score</th><th>Accuracy</th><th>Correct</th><th>Time taken</th><th>Date</th></tr></thead><tbody>{history.map((h,i)=><tr key={h.id} className={h.id===a.id?"current":""}><td>#{h.attempt_number}{h.id===a.id?" · Current":""}</td><td>{h.score===null?"—":Number(h.score).toFixed(2)+" / "+Number(h.max_score??0).toFixed(2)}</td><td>{h.accuracy===null?"—":Number(h.accuracy).toFixed(1)+"%"}</td><td>{h.correct_count}</td><td>{formatTime(h.time_taken_seconds)}</td><td>{h.submitted_at?new Date(h.submitted_at).toLocaleDateString("en-IN"):"—"}</td></tr>)}</tbody></table></div>:<p className="mr-muted">Your completed attempts will appear here.</p>}
    {history.length>1&&<p className="mr-improvement">Score change from first to latest: <b>{(Number(history[history.length-1]?.score??0)-Number(history[0]?.score??0)).toFixed(2)} marks</b></p>}
   </section>
   <div className="mr-actions"><button className="mr-primary" disabled={busy} onClick={()=>void reattempt()}>{busy?"Preparing…":"↻ Reattempt test"}</button><button className="mr-secondary" onClick={()=>router.push("/dashboard")}>Go to dashboard</button><button className="mr-secondary" onClick={()=>router.push("/practice")}>Practice centre</button></div>
  </section>
 </main>;
}
