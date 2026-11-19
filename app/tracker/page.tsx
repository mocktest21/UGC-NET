"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {BookOpenCheck,RefreshCw,Target,CheckCircle2,CircleHelp,ArrowRight,ChartNoAxesCombined} from "lucide-react";
import StudentWorkspaceHeader from "@/components/navigation/StudentWorkspaceHeader";
import MockMasterLoading from "@/app/components/ui/MockMasterLoading";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import "./tracker.css";

type UnitRow={id:string;name:string;unit_number:number|null;total_questions:number;attempted_questions:number;remaining_questions:number;correct_questions:number;incorrect_questions:number;completion:number;accuracy:number};
type PaperRow={paper_code:string;paper_name:string;subject_id:string;subject_name:string;total_questions:number;attempted_questions:number;remaining_questions:number;correct_questions:number;incorrect_questions:number;completion:number;accuracy:number;units:UnitRow[]};
type TrackerData={selected_subject_id:string|null;papers:PaperRow[]};

const pct=(v:number)=>Math.max(0,Math.min(100,Number(v)||0));
const number=(v:number)=>Number(v||0).toLocaleString("en-IN");

export default function SyllabusTrackerPage(){
 const router=useRouter();
 const [db]=useState(()=>createSupabaseBrowserClient());
 const [data,setData]=useState<TrackerData|null>(null);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState("");
 const [activePaper,setActivePaper]=useState("PAPER_1");
 const load=useCallback(async(initial=false)=>{
  if(initial)setLoading(true);else setRefreshing(true);
  setError("");
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError||!auth.user){router.replace("/login");return;}
  const {data:result,error:rpcError}=await db.rpc("student_get_syllabus_tracker");
  if(rpcError){setError(rpcError.message||"Unable to load your syllabus tracker.");setData(null);}
  else setData(result as TrackerData);
  setLoading(false);setRefreshing(false);
 },[db,router]);
 useEffect(()=>{void load(true);},[load]);
 const papers=data?.papers||[];
 const current=papers.find(p=>p.paper_code===activePaper)||papers[0];
 const total=papers.reduce((n,p)=>n+p.total_questions,0);
 const attempted=papers.reduce((n,p)=>n+p.attempted_questions,0);
 const overall=pct(total?attempted/total*100:0);
 const hasPaper2=!!data?.selected_subject_id;
 const completionLabel=useMemo(()=>overall===100?"Question bank fully covered":overall===0?"Start practising to build your coverage":"Keep going — your coverage is growing",[overall]);
 if(loading)return <MockMasterLoading variant="workspace" title="Preparing your syllabus tracker" message="Loading approved questions and your unique attempts."/>;
 return <main className="st-page">
  <StudentWorkspaceHeader/>
  <div className="st-wrap">
   <header className="st-heading">
    <div><span className="st-kicker">PREPARATION OVERVIEW</span><h1>Syllabus Tracker</h1><p>Track your unique question practice across every syllabus unit.</p></div>
    <button className="st-refresh" type="button" onClick={()=>void load(false)} disabled={refreshing}><RefreshCw size={16} className={refreshing?"st-spinning":""}/><span>{refreshing?"Updating":"Refresh"}</span></button>
   </header>
   {error&&<div className="st-error" role="alert"><span>{error}</span><button onClick={()=>void load(false)}>Retry</button></div>}
   {!error&&data&&<>
    <section className="st-overview">
     <div className="st-overview-top"><div><span>OVERALL QUESTION-BANK COVERAGE</span><strong>{overall.toFixed(1)}%</strong><p>{completionLabel}</p></div><div className="st-overview-icon"><BookOpenCheck size={26}/></div></div>
     <div className="st-track"><span style={{width:overall+"%"}}/></div>
     <div className="st-overview-stats"><div><strong>{number(total)}</strong><small>Approved questions</small></div><div><strong>{number(attempted)}</strong><small>Unique attempted</small></div><div><strong>{number(Math.max(0,total-attempted))}</strong><small>Remaining</small></div></div>
    </section>
    <div className="st-paper-tabs" role="tablist" aria-label="Select paper">
     {papers.map(p=><button key={p.paper_code} type="button" role="tab" aria-selected={activePaper===p.paper_code} className={activePaper===p.paper_code?"active":""} onClick={()=>setActivePaper(p.paper_code)}><span>{p.paper_name}</span>{p.paper_code==="PAPER_2"&&<small>{p.subject_name}</small>}</button>)}
    </div>
    {current?<>
     <section className="st-paper-summary">
      <div><span className="st-kicker">{current.paper_name.toUpperCase()}</span><h2>{current.subject_name}</h2><p>Unit-wise question coverage and performance</p></div>
      <div className="st-paper-percent"><strong>{pct(current.completion).toFixed(1)}%</strong><span>Completed</span></div>
     </section>
     <div className="st-stats-row">
      <div><span>Total questions</span><strong>{number(current.total_questions)}</strong></div>
      <div><span>Attempted</span><strong>{number(current.attempted_questions)}</strong></div>
      <div><span>Remaining</span><strong>{number(current.remaining_questions)}</strong></div>
      <div><span>Accuracy</span><strong>{current.attempted_questions?pct(current.accuracy).toFixed(1)+"%":"—"}</strong></div>
     </div>
     <section className="st-units">
      <div className="st-section-heading"><div><h2>Unit-wise progress</h2><p>{current.units.length} syllabus units · {number(current.total_questions)} approved questions</p></div><span><Target size={17}/> Unique coverage</span></div>
      {current.units.length?current.units.map((u,index)=><article className="st-unit-card" key={u.id}>
       <div className="st-unit-top"><div className="st-unit-title"><span className="st-unit-number">{u.unit_number??index+1}</span><div><h3>{u.name}</h3><small>{number(u.attempted_questions)} of {number(u.total_questions)} questions attempted</small></div></div><strong className={u.completion>=70?"good":u.completion>=35?"mid":"low"}>{pct(u.completion).toFixed(1)}%</strong></div>
       <div className="st-track st-unit-track"><span className={u.completion>=70?"good":u.completion>=35?"mid":"low"} style={{width:pct(u.completion)+"%"}}/></div>
       <div className="st-unit-bottom"><span>{number(u.remaining_questions)} remaining</span><span>{number(u.correct_questions)} correct · {number(u.incorrect_questions)} incorrect</span><span>Accuracy: {u.attempted_questions?pct(u.accuracy).toFixed(1)+"%":"—"}</span></div>
      </article>):<div className="st-empty"><CircleHelp size={24}/><strong>No syllabus units found</strong><p>Active units will appear here once they are configured for this paper.</p></div>}
     </section>
    </>:<div className="st-empty"><CircleHelp size={24}/><strong>Paper data is unavailable</strong><p>Check the UGC-NET syllabus configuration and try refreshing.</p></div>}
    {!hasPaper2&&<div className="st-note"><CircleHelp size={17}/><span>Paper 2 subject is not selected on your account yet. Select your Paper 2 subject in your exam preferences to see its unit-wise tracker.</span></div>}
    <p className="st-footnote">Completion counts each approved question only once, even if you attempt it multiple times. Only questions in the approved question bank are included.</p>
   </>}
  </div>
 </main>;
}
