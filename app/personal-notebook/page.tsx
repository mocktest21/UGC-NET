"use client";
import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import "./notebook.css";
import StudentWorkspaceHeader from "@/components/navigation/StudentWorkspaceHeader";
import MockMasterLoading from "@/app/components/ui/MockMasterLoading";
import {Bookmark,AlertCircle,RefreshCw,Trash2,BookOpen,Sparkles,ArrowRight} from "lucide-react";
type Q={id:string;prompt:any;stimulus:any;options:any[];explanation?:any;correctAnswer?:any;subject:string;unit:string;response?:any;testTitle?:string;date?:string;wrongCount?:number;attemptCount?:number;correctCount?:number;incorrectCount?:number};
const promptText=(p:any)=>String(p?.stem?.text??p?.text??p?.stem??p?.content??"Question text unavailable");
const explanationText=(v:any)=>typeof v==="string"?v:String(v?.text??v?.content??v?.html??"");
const correctKey=(key:any)=>key?.correct_option_id??key?.correct_option_ids??key?.correct_answer??key?.answer??key;
const optionIsCorrect=(option:any,index:number,key:any,options:any[])=>{const value=correctKey(key);const ids=Array.isArray(value)?value:[value];return ids.some((x:any)=>{const id=String(x);return id===String(option.id??option.value??index)||id===String.fromCharCode(65+index)||id===String(index+1);});};
const answerText=(v:any,options:any[])=>{if(v===null||v===undefined||v==="")return "Not answered";return (Array.isArray(v)?v:[v]).map(x=>{const o=options.find((z:any)=>String(z.id??z.value??"")===String(x));return o?String(o.text??o.label??x):typeof x==="object"?JSON.stringify(x):String(x)}).join(", ")};
export default function PersonalNotebookPage(){
 const router=useRouter();const [studentId,setStudentId]=useState("");const [bookmarks,setBookmarks]=useState<Q[]>([]);const [incorrect,setIncorrect]=useState<Q[]>([]);const [correct,setCorrect]=useState<Q[]>([]);const [tab,setTab]=useState<"all"|"correct"|"incorrect"|"bookmarks">("all");const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [removing,setRemoving]=useState("");const [startingSmartQuiz,setStartingSmartQuiz]=useState(false);
 const load=useCallback(async()=>{
  try{
  setLoading(true);setError("");
  const db=createSupabaseBrowserClient();
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError){setError("Unable to verify your session. Please retry.");setLoading(false);return;}
  if(!auth.user){router.replace("/login");return;}
  setStudentId(auth.user.id);
  const {data,error:rpcError}=await db.rpc("student_get_personal_notebook");
  if(rpcError){setError("Notebook data could not be loaded. Please retry. "+rpcError.message);setLoading(false);return;}
  const payload=data as {bookmarks?:Q[];incorrect?:Q[];correct?:Q[]};
  setBookmarks(payload.bookmarks||[]);
  setIncorrect(payload.incorrect||[]);
  setCorrect(payload.correct||[]);
  setLoading(false);
  }catch(loadError){setError(loadError instanceof Error?loadError.message:"Notebook could not be loaded. Please retry.");setLoading(false);}
 },[router]);
 useEffect(()=>{void load();},[load]);
 const remove=async(id:string)=>{if(!studentId)return;setRemoving(id);const db=createSupabaseBrowserClient();const {error}=await db.from("bookmarks").delete().eq("student_id",studentId).eq("question_id",id);setRemoving("");if(error){setError(error.message);return;}setBookmarks(old=>old.filter(q=>q.id!==id));};
 const allQuestions=Array.from(new Map([...correct,...incorrect,...bookmarks].map(q=>[q.id,q])).values());
  const rows=tab==="bookmarks"?bookmarks:tab==="correct"?correct:tab==="incorrect"?incorrect:allQuestions;
 const smartQuizCount=new Set([...incorrect.map(q=>q.id),...bookmarks.map(q=>q.id)]).size;
 if(loading)return <MockMasterLoading variant="notebook" title="Loading your personal notebook"/>;
 return <main className="mn-shell"><StudentWorkspaceHeader/><section className="mn-content"><div className="mn-intro"><span>YOUR STUDY SPACE</span><h1>Personal Notebook</h1><p>Your attempted questions stay organised here — correct, incorrect and bookmarked — even after a practice test is completed.</p></div><div className="mn-smart-quiz"><div><span>FOCUSED REVISION</span><strong>Smart Quiz</strong><small>{smartQuizCount} unique incorrect and bookmarked question{smartQuizCount===1?"":"s"}</small></div><button type="button" disabled={loading||startingSmartQuiz||smartQuizCount===0} onClick={async()=>{setError("");setStartingSmartQuiz(true);const db=createSupabaseBrowserClient();const {data,error}=await db.rpc("student_start_smart_quiz");setStartingSmartQuiz(false);if(error){setError(error.message);return;}const result=data as {test_id:string;attempt_id:string;duration_seconds:number};router.push("/practice/session?"+new URLSearchParams({test:result.test_id,attempt:result.attempt_id,minutes:String(Math.ceil(result.duration_seconds/60))}).toString());}}><Sparkles size={16}/>{startingSmartQuiz?"Preparing…":"Start Smart Quiz"}<ArrowRight size={16}/></button></div><div className="mn-tabs"><button className={tab==="all"?"active all":""} onClick={()=>setTab("all")}><BookOpen size={15}/> <span>All</span> <b>{allQuestions.length}</b></button><button className={tab==="correct"?"active correct":""} onClick={()=>setTab("correct")}><span aria-hidden="true">✓</span> <span>Correct</span> <b>{correct.length}</b></button><button className={tab==="incorrect"?"active incorrect":""} onClick={()=>setTab("incorrect")}><AlertCircle size={15}/> <span>Incorrect</span> <b>{incorrect.length}</b></button><button className={tab==="bookmarks"?"active bookmarks":""} onClick={()=>setTab("bookmarks")}><Bookmark size={15}/> <span>Bookmarked</span> <b>{bookmarks.length}</b></button></div>{error&&<p className="mn-error" role="alert">{error} <button type="button" onClick={()=>void load()}><RefreshCw size={13}/> Retry</button></p>}{loading?<div className="mn-empty">Loading your notebook…</div>:rows.length===0?<div className="mn-empty"><span>{tab==="bookmarks"?<Bookmark size={22}/>:tab==="correct"?<BookOpen size={22}/>:<AlertCircle size={22}/>}</span><h2>{tab==="bookmarks"?"No bookmarked questions yet":tab==="correct"?"No correctly answered questions yet":tab==="all"?"No question history yet":"No incorrect questions yet"}</h2><p>{tab==="bookmarks"?"Bookmark a question during a test or while reviewing analysis.":tab==="correct"?"Questions you answer correctly in completed tests will appear here.":"Questions from completed tests will appear here, once per question."}</p></div>:<div className="mn-list">{rows.map((q,i)=><article className="mn-question-card" key={q.id}><div className="mn-card-top"><span>QUESTION {i+1}</span><div><small>{q.subject}</small><small>{q.unit}</small></div></div><h2>{promptText(q.prompt)}</h2>{q.stimulus&&<p className="mn-stimulus">{String(q.stimulus?.text??q.stimulus?.content??q.stimulus)}</p>}{q.options.length>0&&<ol className="mn-options">{q.options.map((o:any,j:number)=>{const isKey=optionIsCorrect(o,j,q.correctAnswer,q.options);return <li key={String(o.id??o.value??j)} className={isKey?"mn-option-correct":""}><b>{String.fromCharCode(65+j)}.</b> {String(o.text??o.label??o.value??"")}{isKey&&<span className="mn-correct-tag">Correct option</span>}</li>})}</ol>}{tab!=="bookmarks"&&<div className={"mn-wrong-meta "+(incorrect.some(item=>item.id===q.id)?"is-incorrect":"is-correct")}><span>Your answer: <b>{answerText(q.response,q.options)}</b></span></div>}{q.correctAnswer!==null&&q.correctAnswer!==undefined&&<div className="mn-correct-answer"><b>Correct option:</b> {answerText(correctKey(q.correctAnswer),q.options)}</div>}{explanationText(q.explanation)&&<div className="mn-explanation"><b>Explanation</b><p>{explanationText(q.explanation)}</p></div>}<div className="mn-card-actions">{tab==="bookmarks"?<button disabled={removing===q.id} onClick={()=>void remove(q.id)}>{removing===q.id?"Removing…":<><Trash2 size={14}/> Remove bookmark</>}</button>:<button onClick={()=>router.push("/practice")}><BookOpen size={14}/> Practice questions</button>}</div></article>)}</div>}</section><footer className="mn-footer">© {new Date().getFullYear()} MockMaster <span>Practice. Improve. Achieve.</span></footer></main>;
}
