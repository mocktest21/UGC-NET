"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import "./session.css";

type Option={id?:string;value?:string;text?:string;label?:string;[key:string]:unknown};
type Q={id:string;questionId:string;type:string;prompt:any;stimulus:any;options:Option[];marks:number;negative:number;responseId:string};
export default function PracticeSessionPage(){
 const router=useRouter();
 const [params,setParams]=useState<URLSearchParams|null>(null);
 useEffect(()=>{setParams(new URLSearchParams(window.location.search));},[]);
 const [db]=useState(()=>typeof window==="undefined"?null:createSupabaseBrowserClient());
 const [questions,setQuestions]=useState<Q[]>([]);
 const [answers,setAnswers]=useState<Record<string,any>>({});
 const [review,setReview]=useState<string[]>([]);
 const [current,setCurrent]=useState(0);
 const [seconds,setSeconds]=useState(0);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [submitted,setSubmitted]=useState(false),[confirm,setConfirm]=useState(false),[student,setStudent]=useState("Student");
 const [saving,setSaving]=useState(false);
 const testId=params?.get("test")||"",attemptId=params?.get("attempt")||"";
 const fmt=(n:number)=>String(Math.floor(n/3600)).padStart(2,"0")+":"+String(Math.floor(n%3600/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");

 useEffect(()=>{if(!db||!params)return;let live=true;void(async()=>{
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError||!auth.user){router.replace("/login");return;}
  if(live)setStudent((auth.user.user_metadata?.full_name as string)||"Student");
  if(!testId||!attemptId){setError("Your practice attempt is missing. Return to the test builder.");setLoading(false);return;}
  const {data:attempt,error:attemptError}=await db.from("test_attempts").select("id,status,expires_at").eq("id",attemptId).maybeSingle();
  if(attemptError||!attempt||attempt.status!=="in_progress"){setError(attemptError?.message||"This practice attempt is no longer active.");setLoading(false);return;}
  const {data:links,error:linkError}=await db.from("test_questions").select("id,question_id,question_version_id,position,marks,negative_marks").eq("test_id",testId).order("position");
  if(linkError){setError(linkError.message);setLoading(false);return;}
  const ids=(links||[]).map((x:any)=>x.question_version_id);
  const {data:versions,error:versionError}=await db.from("question_versions").select("id,question_type,prompt,stimulus,options").in("id",ids);
  if(versionError){setError(versionError.message);setLoading(false);return;}
  const versionMap=new Map((versions||[]).map((v:any)=>[v.id,v]));
  const built=(links||[]).flatMap((link:any)=>{const v:any=versionMap.get(link.question_version_id);return v?[{id:link.id,questionId:link.question_id,type:v.question_type,prompt:v.prompt||{},stimulus:v.stimulus,options:Array.isArray(v.options)?v.options:[],marks:Number(link.marks||2),negative:Number(link.negative_marks||0),responseId:link.id} as Q]:[];});
  const {data:responses}=await db.from("student_responses").select("test_question_id,response,is_marked_for_review").eq("attempt_id",attemptId);
  const answerState:Record<string,any>={},reviewState:string[]=[];
  (responses||[]).forEach((r:any)=>{if(r.response!==null)answerState[r.test_question_id]=r.response;if(r.is_marked_for_review)reviewState.push(r.test_question_id);});
  const expiry=attempt.expires_at?Math.max(0,Math.floor((new Date(attempt.expires_at).getTime()-Date.now())/1000)):Math.max(1,Number(params.get("minutes")||50)*60);
  if(live){setQuestions(built);setAnswers(answerState);setReview(reviewState);setSeconds(expiry);setLoading(false);if(!built.length)setError("No questions were found in this practice attempt.");}
 })();return()=>{live=false;};},[db,router,params,testId,attemptId]);

 const save=useCallback(async(id:string,value:any,flag=review.includes(id))=>{
  if(!db||!attemptId)return;setSaving(true);
  const {error}=await db.rpc("student_save_practice_response",{p_attempt_id:attemptId,p_test_question_id:id,p_response:value===undefined?null:value===null?null:value,p_marked_for_review:flag});
  if(error)setError("Your response could not be saved: "+error.message);
  setSaving(false);
 },[db,attemptId,review]);
 const updateAnswer=(id:string,value:any)=>{setAnswers(old=>({...old,[id]:value}));void save(id,value);};
 const toggleReview=(id:string)=>{const next=!review.includes(id);setReview(old=>next?[...old,id]:old.filter(x=>x!==id));void save(id,answers[id]??null,next);};
 const finish=useCallback(async()=>{
  if(!db||!attemptId)return;setSaving(true);
  const {error}=await db.rpc("student_submit_practice_test",{p_attempt_id:attemptId});
  setSaving(false);if(error){setError(error.message);return;}setSubmitted(true);
 },[db,attemptId]);
 useEffect(()=>{if(loading||submitted||questions.length===0)return;if(seconds<=0){void finish();return;}
  const timer=window.setInterval(()=>setSeconds(s=>{if(s<=1){window.clearInterval(timer);return 0;}return s-1;}),1000);
  return()=>window.clearInterval(timer);
 },[loading,submitted,questions.length,seconds,finish]);
 const q=questions[current];
 const stem=(q?.prompt?.stem?.text||q?.prompt?.text||q?.prompt?.stem||"Question content unavailable").toString();
 const answered=Object.keys(answers).filter(k=>answers[k]!==null&&answers[k]!==undefined&&answers[k]!=="").length;
 const options=useMemo(()=>q?.options||[],[q]);
 const optionId=(o:Option,i:number)=>String(o.id??o.value??i);
 const optionText=(o:Option)=>String(o.text??o.label??o.value??"");
 const selected=(id:string)=>answers[q.id];
 const isChoice=["single_choice","assertion_reason"].includes(q?.type)||(q?.type==="passage"&&options.length>0);
 const isMulti=q?.type==="multiple_choice";
 const renderChoice=()=> <div className="ps-options">{options.map((o,i)=>{const id=optionId(o,i),value=selected(q.id);const active=isMulti?Array.isArray(value)&&value.includes(id):value===id;return <button key={id} className={active?"selected":""} onClick={()=>{if(isMulti){const next=Array.isArray(value)?value.slice():[];updateAnswer(q.id,next.includes(id)?next.filter(x=>x!==id):[...next,id]);}else updateAnswer(q.id,id);}}><i>{String.fromCharCode(65+i)}</i><span>{optionText(o)}</span>{active&&<b>✓</b>}</button>;})}</div>;
 if(loading)return <main className="ps-state">Preparing your test…</main>;
 if(error&&!questions.length)return <main className="ps-state"><div><h2>Unable to start test</h2><p>{error}</p><button onClick={()=>router.push("/practice/build-test")}>Back to test builder</button></div></main>;
 if(submitted)return <main className="ps-result"><div><span>MOCKMASTER · PRACTICE</span><h1>Test submitted</h1><p>Your responses have been saved. You can review your attempt from your dashboard when results are available.</p><div className="ps-result-stats"><b>{questions.length}<small>Total questions</small></b><b>{answered}<small>Answered</small></b><b>{questions.length-answered}<small>Unanswered</small></b></div><button onClick={()=>router.push("/practice/build-test")}>Create another test</button><button className="ps-secondary" onClick={()=>router.push("/dashboard")}>Dashboard</button></div></main>;
 if(!q)return null;
 return <main className="ps-shell">
  <header className="ps-header"><a href="/dashboard" className="ps-brand"><span>M</span> MockMaster</a><div><b>Custom Practice Test</b><small>{student} · {questions.length} questions</small></div><div className={seconds<300?"ps-timer danger":"ps-timer"}><small>TIME LEFT</small><b>{fmt(seconds)}</b></div><button className="ps-submit" onClick={()=>setConfirm(true)}>Submit test</button></header>
  <div className="ps-progress"><span style={{width:((current+1)/questions.length*100)+"%"}}/></div>
  <div className="ps-body"><section className="ps-main"><div className="ps-meta"><span>Question {current+1} of {questions.length} · {q.type.replaceAll("_"," ")}</span><span>+{q.marks} marks · −{q.negative} negative</span></div><article className="ps-question">
   {q.stimulus&&<div className="ps-stimulus"><b>Read the passage / case</b><p>{String(q.stimulus?.text||q.stimulus?.content||q.stimulus)}</p></div>}
   <h1>{stem}</h1>
   {isChoice||isMulti?renderChoice():q.type==="true_false"?<div className="ps-options">{[true,false].map(v=><button key={String(v)} className={selected(q.id)===v?"selected":""} onClick={()=>updateAnswer(q.id,v)}><i>{v?"T":"F"}</i><span>{v?"True":"False"}</span></button>)}</div>:q.type==="numerical"||q.type==="short_answer"? <label className="ps-answer-field"><span>{q.type==="numerical"?"Enter your numerical answer":"Enter your answer"}</span><input value={String(selected(q.id)??"")} onChange={e=>updateAnswer(q.id,e.target.value)} placeholder="Type your answer here"/></label>:<div className="ps-structured-answer"><p>{q.type==="matching"?"Enter your matches as pairs (JSON), for example { \"A\": \"1\", \"B\": \"2\" }.":q.type==="ordering"?"Enter the correct sequence as a JSON array, for example [\"A\",\"C\",\"B\"].":"Enter your structured response. You may use JSON for complex answers."}</p><textarea rows={6} value={typeof selected(q.id)==="string"?selected(q.id):selected(q.id)?JSON.stringify(selected(q.id),null,2):""} onChange={e=>updateAnswer(q.id,e.target.value)} placeholder={q.type==="matching"?"{\"A\":\"1\",\"B\":\"2\"}":q.type==="ordering"?'["A","C","B"]':"Your answer…"}/></div>}
  </article><div className="ps-actions"><button className="ps-outline" onClick={()=>updateAnswer(q.id,null)}>Clear response</button><button className={review.includes(q.id)?"ps-review active":"ps-review"} onClick={()=>toggleReview(q.id)}>{review.includes(q.id)?"Unmark review":"Mark for review"}</button><span/>{saving&&<small>Saving…</small>}<button className="ps-outline" disabled={current===0} onClick={()=>setCurrent(x=>Math.max(0,x-1))}>← Previous</button><button className="ps-next" onClick={()=>setCurrent(x=>Math.min(questions.length-1,x+1))}>{current===questions.length-1?"Last question":"Save & Next →"}</button></div></section>
   <aside className="ps-sidebar"><h2>Question palette</h2><div className="ps-legend"><span><i className="done"/>Answered</span><span><i className="todo"/>Not answered</span><span><i className="flag"/>Review</span></div><div className="ps-grid">{questions.map((item,i)=><button key={item.id} className={(current===i?"current ":"")+(answers[item.id]!==undefined&&answers[item.id]!==null&&answers[item.id]!==""?"done ":"")+(review.includes(item.id)?"flag":"")} onClick={()=>setCurrent(i)}>{i+1}</button>)}</div><div className="ps-side-count"><span>Answered <b>{answered}</b></span><span>Remaining <b>{questions.length-answered}</b></span></div><button className="ps-submit-wide" onClick={()=>setConfirm(true)}>Submit test</button></aside>
  </div>
  {confirm&&<div className="ps-overlay"><div className="ps-dialog"><h2>Submit your test?</h2><p>You have answered {answered} out of {questions.length} questions. Unanswered questions will be submitted as blank.</p><div><button className="ps-outline" onClick={()=>setConfirm(false)}>Continue test</button><button className="ps-submit" onClick={()=>{setConfirm(false);void finish();}}>Confirm submission</button></div></div></div>}
 </main>;
}
