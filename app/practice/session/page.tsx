"use client";
import Link from "next/link";
import {Check,Bookmark,ArrowLeft,ArrowRight,Maximize2} from "lucide-react";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
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
 const [bookmarked,setBookmarked]=useState<string[]>([]);
 const [current,setCurrent]=useState(0);
 const [seconds,setSeconds]=useState(0);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [testStarted,setTestStarted]=useState(false);
 const [launchCountdown,setLaunchCountdown]=useState<number|null>(null);
 const [isFullscreen,setIsFullscreen]=useState(false);
 const [submitted,setSubmitted]=useState(false),[confirm,setConfirm]=useState(false),[student,setStudent]=useState("Student"),[studentId,setStudentId]=useState("");
 const [saving,setSaving]=useState(false),[showPalette,setShowPalette]=useState(false),[showExitConfirm,setShowExitConfirm]=useState(false),[saveError,setSaveError]=useState(""),[expiresAt,setExpiresAt]=useState<string|null>(null);
 const allowUnload=useRef(false);
 const pendingSaves=useRef(new Map<string,{value:any;flag:boolean}>());
 const saveTimers=useRef(new Map<string,ReturnType<typeof setTimeout>>());
 const saveChain=useRef(Promise.resolve());
 const testId=params?.get("test")||"",attemptId=params?.get("attempt")||"";
 const fmt=(n:number)=>String(Math.floor(n/3600)).padStart(2,"0")+":"+String(Math.floor(n%3600/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");

 useEffect(()=>{const update=()=>setIsFullscreen(!!document.fullscreenElement);document.addEventListener("fullscreenchange",update);update();return()=>document.removeEventListener("fullscreenchange",update);},[]);
 const enterFullscreen=async()=>{if(typeof document==="undefined")return false;try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:"hide"});const active=!!document.fullscreenElement;setIsFullscreen(active);return active;}catch{return false;}};
 useEffect(()=>{if(!db||!params)return;let live=true;void(async()=>{
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError){setError("Could not verify your sign-in. Please retry.");setLoading(false);return;}
  if(!auth.user){router.replace("/login");return;}
  if(live){setStudent((auth.user.user_metadata?.full_name as string)||"Student");setStudentId(auth.user.id);}
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
  const {data:bookmarkRows,error:bookmarkError}=await db.from("bookmarks").select("question_id").eq("student_id",auth.user.id).in("question_id",built.map((q:any)=>q.questionId));
  if(bookmarkError){setError("Bookmarks could not be loaded: "+bookmarkError.message);setLoading(false);return;}
  const {data:responses,error:responseError}=await db.from("student_responses").select("test_question_id,response,is_marked_for_review").eq("attempt_id",attemptId);
  if(responseError){setError("Saved responses could not be loaded: "+responseError.message);setLoading(false);return;}
  const answerState:Record<string,any>={},reviewState:string[]=[];
  (responses||[]).forEach((r:any)=>{if(r.response!==null)answerState[r.test_question_id]=r.response;if(r.is_marked_for_review)reviewState.push(r.test_question_id);});
  const expiry=attempt.expires_at?Math.max(0,Math.floor((new Date(attempt.expires_at).getTime()-Date.now())/1000)):Math.max(1,Number(params.get("minutes")||50)*60);
  if(live){setQuestions(built);setAnswers(answerState);setReview(reviewState);setBookmarked((bookmarkRows||[]).map((b:any)=>b.question_id));setExpiresAt(attempt.expires_at||null);setSeconds(expiry);setLoading(false);if(!built.length)setError("No questions were found in this practice attempt.");}
 })();return()=>{live=false;};},[db,router,params,testId,attemptId]);

 const persist=useCallback((id:string,value:any,flag:boolean)=>{
  if(!db||!attemptId)return Promise.resolve(false);
  setSaving(true);
  const task=saveChain.current.then(async()=>{
    const {error}=await db.rpc("student_save_practice_response",{p_attempt_id:attemptId,p_test_question_id:id,p_response:value===undefined?null:value===null?null:value,p_marked_for_review:flag});
    if(error){setSaveError("Your response could not be saved. Please retry before continuing. "+error.message);return false;}
    return true;
  }).catch((error:any)=>{setSaveError("Your response could not be saved. "+(error?.message||"Please retry."));return false;});
  saveChain.current=task.then(()=>undefined);
  return task.finally(()=>setSaving(false));
 },[db,attemptId]);
 const save=useCallback(async(id:string,value:any,flag=review.includes(id))=>persist(id,value,flag),[persist,review]);
 const flushPending=useCallback(async()=>{
  for(const id of pendingSaves.current.keys()){const timer=saveTimers.current.get(id);if(timer)clearTimeout(timer);saveTimers.current.delete(id);}
  let ok=true;
  while(pendingSaves.current.size){
    const entries=Array.from(pendingSaves.current.entries());
    for(const [id,item] of entries){
      const success=await persist(id,item.value,item.flag);
      if(!success){ok=false;break;}
      if(pendingSaves.current.get(id)===item)pendingSaves.current.delete(id);
    }
    if(!ok)break;
  }
  const complete=ok&&pendingSaves.current.size===0;if(complete)setSaveError("");return complete;
 },[persist]);
 const updateAnswer=(id:string,value:any)=>{
  setAnswers(old=>({...old,[id]:value}));
  pendingSaves.current.set(id,{value,flag:review.includes(id)});
  const oldTimer=saveTimers.current.get(id);if(oldTimer)clearTimeout(oldTimer);
  saveTimers.current.set(id,setTimeout(()=>{void flushPending();},500));
 };
 const toggleReview=(id:string)=>{
  const next=!review.includes(id);setReview(old=>next?[...old,id]:old.filter(x=>x!==id));
  const value=answers[id]??null;
  pendingSaves.current.set(id,{value,flag:next});
  const timer=saveTimers.current.get(id);if(timer)clearTimeout(timer);
  saveTimers.current.set(id,setTimeout(()=>{void flushPending();},500));
 };
 const toggleBookmark=async(questionId:string)=>{
  if(!db||!studentId)return;
  const exists=bookmarked.includes(questionId);
  setBookmarked(old=>exists?old.filter(x=>x!==questionId):[...old,questionId]);
  const result=exists
   ?await db.from("bookmarks").delete().eq("student_id",studentId).eq("question_id",questionId)
   :await db.from("bookmarks").insert({student_id:studentId,question_id:questionId});
  if(result.error){setBookmarked(old=>exists?[...old,questionId]:old.filter(x=>x!==questionId));setError("Bookmark could not be saved: "+result.error.message);}
 };
 const exitAttempt=async()=>{
  const flushed=await flushPending();if(!flushed)return;
  if(db&&attemptId){const {error}=await db.rpc("student_abandon_practice_attempt",{p_attempt_id:attemptId});if(error){setError("Could not safely exit this attempt: "+error.message);return;}}
  router.push("/practice");
 };
 const finish=useCallback(async()=>{
  if(!db||!attemptId)return;const flushed=await flushPending();if(!flushed)return;setSaving(true);
  const {error}=await db.rpc("student_submit_practice_test",{p_attempt_id:attemptId});
  setSaving(false);if(error){setError(error.message);return;}allowUnload.current=true;setSubmitted(true);router.replace("/practice/result?"+new URLSearchParams({attempt:attemptId}).toString());
 },[db,attemptId,router,flushPending]);
 useEffect(()=>{
  if(launchCountdown===null)return;
  if(launchCountdown<=0){setLaunchCountdown(null);setTestStarted(true);return;}
  const timer=window.setTimeout(()=>setLaunchCountdown(value=>value===null?null:value-1),1000);
  return()=>window.clearTimeout(timer);
 },[launchCountdown]);
 useEffect(()=>{
  if(loading||!testStarted||submitted||!expiresAt)return;
  const sync=()=>setSeconds(Math.max(0,Math.floor((new Date(expiresAt).getTime()-Date.now())/1000)));
  sync();
  const tick=window.setInterval(()=>setSeconds(s=>Math.max(0,s-1)),1000);
  const timer=window.setInterval(sync,30000);
  const visible=()=>{if(document.visibilityState==="visible")sync();};
  document.addEventListener("visibilitychange",visible);
  return()=>{window.clearInterval(tick);window.clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
 },[loading,testStarted,submitted,expiresAt]);
 useEffect(()=>{if(!loading&&testStarted&&!submitted&&questions.length>0&&seconds<=0)void finish();},[loading,testStarted,submitted,questions.length,seconds,finish]);
 useEffect(()=>()=>{for(const timer of saveTimers.current.values())clearTimeout(timer);},[]);
 useEffect(()=>{
  if(loading||!testStarted||submitted)return;
  const onBeforeUnload=(event:BeforeUnloadEvent)=>{if(allowUnload.current)return;event.preventDefault();event.returnValue="Your test is still in progress.";};
  window.addEventListener("beforeunload",onBeforeUnload);
  return()=>window.removeEventListener("beforeunload",onBeforeUnload);
 },[loading,testStarted,submitted]);
 useEffect(()=>{
  if(loading||submitted)return;
  window.history.pushState({mmTestSession:true},"",window.location.href);
  const onPopState=()=>{window.history.pushState({mmTestSession:true},"",window.location.href);setShowExitConfirm(true);};
  window.addEventListener("popstate",onPopState);
  return()=>window.removeEventListener("popstate",onPopState);
 },[loading,testStarted,submitted]);
 useEffect(()=>{
  if(!confirm&&!showExitConfirm)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){setConfirm(false);setShowExitConfirm(false);}};
  document.addEventListener("keydown",onKey);
  const target=document.querySelector(".ps-dialog button") as HTMLButtonElement|null;target?.focus();
  return()=>document.removeEventListener("keydown",onKey);
 },[confirm,showExitConfirm]);
 const goNext=async()=>{if(!await flushPending())return;setCurrent(x=>Math.min(questions.length-1,x+1));};
 const q=questions[current];
 const stem=(q?.prompt?.stem?.text||q?.prompt?.text||q?.prompt?.stem||"Question content unavailable").toString();
 const answered=Object.keys(answers).filter(k=>answers[k]!==null&&answers[k]!==undefined&&answers[k]!=="").length;
 const options=useMemo(()=>q?.options||[],[q]);
 const optionId=(o:Option,i:number)=>String(o.id??o.value??i);
 const optionText=(o:Option)=>String(o.text??o.label??o.value??"");
 const selected=(id:string)=>answers[q.id];
 const isChoice=["single_choice","assertion_reason"].includes(q?.type)||(q?.type==="passage"&&options.length>0);
 const isMulti=q?.type==="multiple_choice";
 if(loading)return <main className="ps-launch-screen"><div className="ps-launch-brand">M</div><div className="ps-launch-dots"><i/><i/><i/></div><h1>Preparing your test</h1><p>Loading questions and restoring your exam workspace…</p></main>;
 const renderChoice=()=> <div className="ps-options">{options.map((o,i)=>{const id=optionId(o,i),value=selected(q.id);const active=isMulti?Array.isArray(value)&&value.includes(id):value===id;return <button key={id} className={active?"selected":""} onClick={()=>{if(isMulti){const next=Array.isArray(value)?value.slice():[];updateAnswer(q.id,next.includes(id)?next.filter(x=>x!==id):[...next,id]);}else updateAnswer(q.id,id);}}><i>{String.fromCharCode(65+i)}</i><span>{optionText(o)}</span>{active&&<b><Check size={15}/></b>}</button>;})}</div>;
 if(!loading&&!error&&!testStarted&&questions.length>0)return <main className="ps-launch-screen"><div className="ps-launch-brand"><span>M</span><b>MockMaster</b></div>{launchCountdown!==null?<><div className="ps-count-label">YOUR TEST STARTS IN</div><div className="ps-count-ring" style={{background:`conic-gradient(#fff ${((5-launchCountdown)/5)*360}deg, #ffffff35 0deg)`}}><span>{launchCountdown}</span></div><h1>Get ready for your test</h1><p className="ps-ready-status">● Ready</p><div className="ps-launch-stats"><div><b>{questions.length}</b><small>Questions</small></div><div><b>{params?.get("minutes")||50} min</b><small>Time limit</small></div><div><b>+{questions[0]?.marks||2} / {questions[0]?.negative||0}</b><small>Marking</small></div></div><ul className="ps-launch-rules"><li>The timer starts as soon as the test opens.</li><li>Your answers are saved as you go.</li><li>Stay in full screen. Leaving it is recorded.</li></ul></>:<><h1>Your test is ready</h1><p>{questions.length} questions loaded. Enter fullscreen to begin your attempt.</p><button type="button" className="ps-next" style={{marginTop:24,padding:"14px 24px"}} onClick={async()=>{await enterFullscreen();setLaunchCountdown(5);}}>{isFullscreen?"Start now":"Enter fullscreen & start test"}</button></>}{error&&<p style={{marginTop:12}}>{error}</p>}</main>;
 if(error&&!questions.length)return <main className="ps-state"><div><h2>Unable to start test</h2><p>{error}</p><button onClick={()=>router.push("/practice/build-test")}>Back to test builder</button></div></main>;
 if(submitted)return <main className="ps-result"><div><span>MOCKMASTER · PRACTICE</span><h1>Test submitted</h1><p>Your responses have been saved. You can review your attempt from your dashboard when results are available.</p><div className="ps-result-stats"><b>{questions.length}<small>Total questions</small></b><b>{answered}<small>Answered</small></b><b>{questions.length-answered}<small>Unanswered</small></b></div><button onClick={()=>router.push("/practice/build-test")}>Create another test</button><button className="ps-secondary" onClick={()=>router.push("/dashboard")}>Dashboard</button></div></main>;
 if(!q)return null;
 return <main className="ps-shell">
  <header className="ps-header"><Link href="/dashboard" className="ps-brand" aria-label="Exit test" onClick={event=>{event.preventDefault();setShowExitConfirm(true);}}><span>M</span><span className="ps-brand-name">MockMaster</span><span className="ps-mobile-exit"><ArrowLeft size={16}/> Exit</span></Link><div className={seconds<60?"ps-timer danger":seconds<300?"ps-timer warn":"ps-timer"} aria-label="Time remaining"><span className="ps-mobile-clock">◷</span><b>{fmt(seconds)}</b></div>{!isFullscreen&&<button type="button" className="ps-fullscreen-btn" onClick={()=>void enterFullscreen()}><Maximize2 size={15}/> Full Screen</button>}</header>
  <div className="ps-progress"><span style={{width:((current+1)/questions.length*100)+"%"}}/></div>
  <div className="ps-body"><section className="ps-main"><div className="ps-meta"><span>Question {current+1} of {questions.length} · {q.type.replaceAll("_"," ")}</span><span>+{q.marks} marks · −{q.negative} negative</span></div>{(saveError||error)&&<div className="ps-save-error" role="alert"><b>{saveError?"Save failed":"Notice"}</b><span>{saveError||error}</span>{saveError&&<button type="button" onClick={()=>void flushPending()}>Retry save</button>}</div>}
  <article className="ps-question">
   {q.stimulus&&<div className="ps-stimulus"><b>Read the passage / case</b><p>{String(q.stimulus?.text||q.stimulus?.content||q.stimulus)}</p></div>}
   <h1>{stem}</h1>
   {isChoice||isMulti?renderChoice():q.type==="true_false"?<div className="ps-options">{[true,false].map(v=><button key={String(v)} className={selected(q.id)===v?"selected":""} onClick={()=>updateAnswer(q.id,v)}><i>{v?"T":"F"}</i><span>{v?"True":"False"}</span></button>)}</div>:q.type==="numerical"||q.type==="short_answer"? <label className="ps-answer-field"><span>{q.type==="numerical"?"Enter your numerical answer":"Enter your answer"}</span><input value={String(selected(q.id)??"")} onChange={e=>updateAnswer(q.id,e.target.value)} placeholder="Type your answer here"/></label>:<div className="ps-structured-answer"><p>{q.type==="matching"?"Enter your matches as pairs (JSON), for example { \"A\": \"1\", \"B\": \"2\" }.":q.type==="ordering"?"Enter the correct sequence as a JSON array, for example [\"A\",\"C\",\"B\"].":"Enter your structured response. You may use JSON for complex answers."}</p><textarea rows={6} value={typeof selected(q.id)==="string"?selected(q.id):selected(q.id)?JSON.stringify(selected(q.id),null,2):""} onChange={e=>updateAnswer(q.id,e.target.value)} placeholder={q.type==="matching"?"{\"A\":\"1\",\"B\":\"2\"}":q.type==="ordering"?'["A","C","B"]':"Your answer…"}/></div>}
  </article><div className="ps-actions"><button className="ps-outline" onClick={()=>updateAnswer(q.id,null)}>Clear response</button><button className={review.includes(q.id)?"ps-review active":"ps-review"} onClick={()=>toggleReview(q.id)}>{review.includes(q.id)?"Unmark review":"Mark for review"}</button><button className={bookmarked.includes(q.questionId)?"ps-bookmark active":"ps-bookmark"} onClick={()=>void toggleBookmark(q.questionId)}><Bookmark size={14}/>{bookmarked.includes(q.questionId)?"Saved":"Bookmark"}</button><span/>{saving&&<small>Saving…</small>}<button className="ps-outline" disabled={current===0} onClick={async()=>{if(await flushPending())setCurrent(x=>Math.max(0,x-1));}}><ArrowLeft size={14}/> Previous</button><button className="ps-next" disabled={saving||!!saveError} onClick={()=>void goNext()}>{current===questions.length-1? "Last question":<>Save & Next <ArrowRight size={14}/></>}</button></div></section>
   <aside className={showPalette?"ps-sidebar is-open":"ps-sidebar"}><h2>Question palette</h2><div className="ps-legend"><span><i className="done"/>Answered</span><span><i className="todo"/>Not answered</span><span><i className="flag"/>Review</span></div><div className="ps-grid">{questions.map((item,i)=><button key={item.id} className={(current===i?"current ":"")+(answers[item.id]!==undefined&&answers[item.id]!==null&&answers[item.id]!==""?"done ":"")+(review.includes(item.id)?"flag":"")} onClick={async()=>{if(await flushPending())setCurrent(i);}}>{i+1}</button>)}</div><div className="ps-side-count"><span>Answered <b>{answered}</b></span><span>Remaining <b>{questions.length-answered}</b></span></div><button className="ps-submit-wide" onClick={()=>setConfirm(true)}>Submit test</button></aside>
  </div>
  <footer className="ps-bottom-bar"><button className="ps-bottom-previous" type="button" disabled={current===0} onClick={async()=>{if(await flushPending())setCurrent(x=>Math.max(0,x-1));}} aria-label="Previous question"><ArrowLeft size={18}/></button><button type="button" className="ps-question-count" onClick={()=>setShowPalette(v=>!v)} aria-label="Open question palette" aria-expanded={showPalette}><span className="ps-palette-symbol">▦</span>{current+1} <span>/</span> {questions.length}</button><button className="ps-bottom-submit" type="button" disabled={saving||!!saveError} onClick={()=>void goNext()}>{current===questions.length-1?"Last question":<>Save &amp; Next <ArrowRight size={17}/></>}</button></footer>
  {showExitConfirm&&<div className="ps-overlay" role="presentation"><div className="ps-dialog" role="dialog" aria-modal="true" aria-labelledby="ps-exit-title"><h2 id="ps-exit-title">Exit this test?</h2><p>Your current attempt will be abandoned. Make sure all pending answers are saved before leaving.</p><div><button className="ps-outline" onClick={()=>setShowExitConfirm(false)}>Continue test</button><button className="ps-submit" onClick={()=>{setShowExitConfirm(false);void exitAttempt();}}>Exit test</button></div></div></div>}
  {confirm && (
    <div className="ps-overlay" role="presentation">
      <div className="ps-dialog" role="dialog" aria-modal="true" aria-labelledby="ps-submit-title">
        <h2 id="ps-submit-title">Submit your test?</h2>
        <p>You have answered {answered} out of {questions.length} questions. Unanswered questions will be submitted as blank.</p>
        <div>
          <button className="ps-outline" onClick={() => setConfirm(false)}>Continue test</button>
          <button className="ps-submit" disabled={saving || !!saveError} onClick={() => { setConfirm(false); void finish(); }}>Confirm submission</button>
        </div>
      </div>
    </div>
  )}
 </main>;
}
