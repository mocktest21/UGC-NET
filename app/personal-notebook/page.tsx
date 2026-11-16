"use client";
import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import "./notebook.css";
type Q={id:string;prompt:any;stimulus:any;options:any[];subject:string;unit:string;response?:any;testTitle?:string;date?:string;wrongCount?:number};
const promptText=(p:any)=>String(p?.stem?.text??p?.text??p?.stem??p?.content??"Question text unavailable");
const answerText=(v:any,options:any[])=>{if(v===null||v===undefined||v==="")return "Not answered";return (Array.isArray(v)?v:[v]).map(x=>{const o=options.find((z:any)=>String(z.id??z.value??"")===String(x));return o?String(o.text??o.label??x):typeof x==="object"?JSON.stringify(x):String(x)}).join(", ")};
export default function PersonalNotebookPage(){
 const router=useRouter();const [studentId,setStudentId]=useState("");const [bookmarks,setBookmarks]=useState<Q[]>([]);const [incorrect,setIncorrect]=useState<Q[]>([]);const [tab,setTab]=useState<"bookmarks"|"incorrect">("bookmarks");const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [removing,setRemoving]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  const db=createSupabaseBrowserClient();
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError){setError("Unable to verify your session. Please retry.");setLoading(false);return;}
  if(!auth.user){router.replace("/login");return;}
  setStudentId(auth.user.id);
  const {data,error:rpcError}=await db.rpc("student_get_personal_notebook");
  if(rpcError){setError("Notebook data could not be loaded. Please retry. "+rpcError.message);setLoading(false);return;}
  const payload=data as {bookmarks?:Q[];incorrect?:Q[]};
  setBookmarks(payload.bookmarks||[]);
  setIncorrect(payload.incorrect||[]);
  setLoading(false);
 },[router]);
 useEffect(()=>{void load();},[load]);
 const remove=async(id:string)=>{if(!studentId)return;setRemoving(id);const db=createSupabaseBrowserClient();const {error}=await db.from("bookmarks").delete().eq("student_id",studentId).eq("question_id",id);setRemoving("");if(error){setError(error.message);return;}setBookmarks(old=>old.filter(q=>q.id!==id));};
 const rows=tab==="bookmarks"?bookmarks:incorrect;
 return <main className="mn-shell"><header className="mn-header"><a href="/dashboard" className="mn-brand"><span>M</span>MockMaster</a><nav><a href="/dashboard">Dashboard</a><a href="/practice">Practice</a><a href="/live-test">Live Test</a><a className="active" href="/personal-notebook">Personal Notebook</a></nav><button onClick={()=>router.push("/dashboard")}>Dashboard</button></header><section className="mn-content"><div className="mn-intro"><span>YOUR STUDY SPACE</span><h1>Personal Notebook</h1><p>Keep saved questions and review questions you answered incorrectly.</p></div><div className="mn-tabs"><button className={tab==="bookmarks"?"active":""} onClick={()=>setTab("bookmarks")}>☆ Bookmarked <b>{bookmarks.length}</b></button><button className={tab==="incorrect"?"active":""} onClick={()=>setTab("incorrect")}>↻ Incorrect history <b>{incorrect.length}</b></button></div>{error&&<p className="mn-error">{error}</p>}{loading?<div className="mn-empty">Loading your notebook…</div>:rows.length===0?<div className="mn-empty"><span>{tab==="bookmarks"?"☆":"✓"}</span><h2>{tab==="bookmarks"?"No bookmarked questions yet":"No incorrect questions yet"}</h2><p>{tab==="bookmarks"?"Bookmark a question during a test or while reviewing analysis.":"Incorrectly answered questions from completed tests will appear here, once per question."}</p></div>:<div className="mn-list">{rows.map((q,i)=><article className="mn-question-card" key={q.id}><div className="mn-card-top"><span>QUESTION {i+1}</span><div><small>{q.subject}</small><small>{q.unit}</small></div></div><h2>{promptText(q.prompt)}</h2>{q.stimulus&&<p className="mn-stimulus">{String(q.stimulus?.text??q.stimulus?.content??q.stimulus)}</p>}{q.options.length>0&&<ol className="mn-options">{q.options.map((o:any,j:number)=><li key={String(o.id??o.value??j)}><b>{String.fromCharCode(65+j)}.</b> {String(o.text??o.label??o.value??"")}</li>)}</ol>}{tab==="incorrect"&&<div className="mn-wrong-meta"><span>Your answer: <b>{answerText(q.response,q.options)}</b></span><span>Test: {q.testTitle}</span><span>Last incorrect: {q.date?new Date(q.date).toLocaleString("en-IN"):"—"} · Incorrect {q.wrongCount} time(s)</span></div>}<div className="mn-card-actions">{tab==="bookmarks"?<button disabled={removing===q.id} onClick={()=>void remove(q.id)}>{removing===q.id?"Removing…":"Remove bookmark"}</button>:<button onClick={()=>router.push("/practice")}>Practice questions</button>}</div></article>)}</div>}</section><footer className="mn-footer">© {new Date().getFullYear()} MockMaster <span>Practice. Improve. Achieve.</span></footer></main>;
}
