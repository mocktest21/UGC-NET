"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import "./session.css";

type Option={id?:string;value?:string;text?:string;label?:string};
type Q={id:string;prompt:any;options:Option[];marks:number;negative:number;section:string};
export default function PracticeSessionPage(){
 const router=useRouter();const [params,setParams]=useState<URLSearchParams|null>(null);\n useEffect(()=>{setParams(new URLSearchParams(window.location.search));},[]);
 const [db]=useState(()=>typeof window==="undefined"?null:createSupabaseBrowserClient());
 const [questions,setQuestions]=useState<Q[]>([]);
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const [review,setReview]=useState<string[]>([]);
 const [current,setCurrent]=useState(0);
 const [seconds,setSeconds]=useState(Math.max(1,Number(params?.get("minutes")||50))*60);
 const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 const [submitted,setSubmitted]=useState(false);const [confirm,setConfirm]=useState(false);
 const [student,setStudent]=useState("Student");
 const paper=params?.get("paper")||"",subject=params?.get("subject")||"",unit=params?.get("unit")||"all";
 const requested=Math.max(1,Math.min(300,Number(params?.get("questions")||50)));
 const language=params?.get("language")||"en",source=params?.get("source")||"all";
 const fmt=(n:number)=>String(Math.floor(n/3600)).padStart(2,"0")+":"+String(Math.floor(n%3600/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");

 useEffect(()=>{if(!db||!params)return;let live=true;void(async()=>{
  const {data:auth,error:authError}=await db.auth.getUser();if(authError||!auth.user){router.replace("/login");return;}
  if(live)setStudent((auth.user.user_metadata?.full_name as string)||"Student");
  if(!paper){setError("Test configuration is missing. Return to the builder and select your test.");setLoading(false);return;}
  let q=db.from("questions").select("id,subject_id,unit_id,source_type,question_type").eq("status","approved").eq("paper_id",paper).eq("language_code",language);
  if(subject)q=q.eq("subject_id",subject);
  if(unit!=="all")q=q.eq("unit_id",unit);
  if(source==="pyq")q=q.eq("source_type","previous_year");
  if(source==="expected")q=q.eq("source_type","admin_created");
  const {data:base,error:baseError}=await q;
  if(baseError){if(live){setError(baseError.message);setLoading(false);}return;}
  const shuffled=[...(base||[])].sort(()=>Math.random()-.5).slice(0,requested);
  if(!shuffled.length){if(live){setError("No approved questions match this test configuration.");setLoading(false);}return;}
  const ids=shuffled.map(x=>x.id);
  const {data:versions,error:versionError}=await db.from("question_versions").select("question_id,prompt,options,default_marks,default_negative_marks,version_number").in("question_id",ids).order("version_number",{ascending:false});
  if(versionError){if(live){setError(versionError.message);setLoading(false);}return;}
  const latest=new Map<string,any>();for(const v of versions||[])if(!latest.has(v.question_id))latest.set(v.question_id,v);
  const built=shuffled.flatMap((item:any)=>{const v=latest.get(item.id);if(!v)return[];return[{id:item.id,prompt:v.prompt,options:Array.isArray(v.options)?v.options:[],marks:Number(v.default_marks||2),negative:Number(v.default_negative_marks||0),section:"Practice"} as Q];});
  if(live){setQuestions(built);setLoading(false);if(!built.length)setError("Question content is not available yet.");}
 })();return()=>{live=false;};},[db,router,params,paper,subject,unit,requested,language,source]);

 const finish=useCallback(()=>setSubmitted(true),[]);
 useEffect(()=>{if(loading||submitted||questions.length===0)return;const timer=window.setInterval(()=>setSeconds(s=>{if(s<=1){window.clearInterval(timer);finish();return 0;}return s-1;}),1000);return()=>window.clearInterval(timer);},[loading,submitted,questions.length,finish]);
 const q=questions[current];
 const stem=(q?.prompt?.stem?.text||q?.prompt?.text||q?.prompt?.stem||"Question content unavailable").toString();
 const answered=Object.keys(answers).length;
 const options=useMemo(()=>q?.options||[],[q]);
 function optionId(o:Option,i:number){return String(o.id??o.value??i);}
 function optionText(o:Option){return String(o.text??o.label??o.value??"");}
 function choose(id:string){setAnswers(old=>({...old,[q.id]:id}));}
 if(loading)return <main className="ps-state">Preparing your test…</main>;
 if(error)return <main className="ps-state"><div><h2>Unable to start test</h2><p>{error}</p><button onClick={()=>router.push("/practice/build-test")}>Back to test builder</button></div></main>;
 if(submitted)return <main className="ps-result"><div><span>MOCKMASTER · PRACTICE</span><h1>Test submitted</h1><p>Your practice session has ended.</p><div className="ps-result-stats"><b>{questions.length}<small>Total questions</small></b><b>{answered}<small>Answered</small></b><b>{questions.length-answered}<small>Unanswered</small></b></div><button onClick={()=>router.push("/practice/build-test")}>Create another test</button><button className="ps-secondary" onClick={()=>router.push("/dashboard")}>Dashboard</button></div></main>;
 if(!q)return null;
 return <main className="ps-shell">
  <header className="ps-header"><a href="/dashboard" className="ps-brand"><span>M</span> MockMaster</a><div><b>Custom Practice Test</b><small>{student} · {questions.length} questions</small></div><div className={seconds<300?"ps-timer danger":"ps-timer"}><small>TIME LEFT</small><b>{fmt(seconds)}</b></div><button className="ps-submit" onClick={()=>setConfirm(true)}>Submit test</button></header>
  <div className="ps-progress"><span style={{width:((current+1)/questions.length*100)+"%"}}/></div>
  <div className="ps-body"><section className="ps-main"><div className="ps-meta"><span>Question {current+1} of {questions.length}</span><span>+{q.marks} marks · −{q.negative} negative</span></div><article className="ps-question"><h1>{stem}</h1><p>Select one option</p><div className="ps-options">{options.map((o,i)=><button key={optionId(o,i)} className={answers[q.id]===optionId(o,i)?"selected":""} onClick={()=>choose(optionId(o,i))}><i>{String.fromCharCode(65+i)}</i><span>{optionText(o)}</span>{answers[q.id]===optionId(o,i)&&<b>✓</b>}</button>)}</div></article><div className="ps-actions"><button className="ps-outline" onClick={()=>{setAnswers(a=>{const n={...a};delete n[q.id];return n;});}}>Clear response</button><button className={review.includes(q.id)?"ps-review active":"ps-review"} onClick={()=>setReview(r=>r.includes(q.id)?r.filter(x=>x!==q.id):[...r,q.id])}>{review.includes(q.id)?"Unmark review":"Mark for review"}</button><span/><button className="ps-outline" disabled={current===0} onClick={()=>setCurrent(x=>Math.max(0,x-1))}>← Previous</button><button className="ps-next" onClick={()=>setCurrent(x=>Math.min(questions.length-1,x+1))}>{current===questions.length-1?"Last question":"Save & Next →"}</button></div></section>
   <aside className="ps-sidebar"><h2>Question palette</h2><div className="ps-legend"><span><i className="done"/>Answered</span><span><i className="todo"/>Not answered</span><span><i className="flag"/>Review</span></div><div className="ps-grid">{questions.map((item,i)=><button key={item.id} className={(current===i?"current ":"")+(answers[item.id]?"done ":"")+(review.includes(item.id)?"flag":"")} onClick={()=>setCurrent(i)}>{i+1}</button>)}</div><div className="ps-side-count"><span>Answered <b>{answered}</b></span><span>Remaining <b>{questions.length-answered}</b></span></div><button className="ps-submit-wide" onClick={()=>setConfirm(true)}>Submit test</button></aside>
  </div>
  {confirm&&<div className="ps-overlay"><div className="ps-dialog"><h2>Submit your test?</h2><p>You have answered {answered} out of {questions.length} questions. Unanswered questions will be submitted as blank.</p><div><button className="ps-outline" onClick={()=>setConfirm(false)}>Continue test</button><button className="ps-submit" onClick={()=>{setConfirm(false);finish();}}>Confirm submission</button></div></div></div>}
 </main>;
}
