"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {Activity,BarChart3,BookOpenCheck,CalendarDays,ChevronDown,Clock3,RefreshCw,Target} from "lucide-react";
import StudentWorkspaceHeader from "@/components/navigation/StudentWorkspaceHeader";
import MockMasterLoading from "@/app/components/ui/MockMasterLoading";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import "./analytics.css";

type DailyRow={activity_date:string;questions:number;question_ids:string[]};
type AnalyticsData={
 overall:{completed_tests:number;answered_responses:number;correct_answers:number;incorrect_answers:number;unique_questions_attempted:number;accuracy:number|null;average_time_per_question:number|null};
 papers:Array<{paper_code:string;paper_name:string;subject_name:string;attempted:number;correct:number;incorrect:number;accuracy:number|null}>;
 units:Array<{id:string;name:string;unit_number:number;paper_name:string;attempted:number;correct:number;incorrect:number;accuracy:number|null}>;
 topics:Array<{id:string;name:string;unit_id:string;unit_name:string;attempted:number;correct:number;incorrect:number;accuracy:number|null}>;
 difficulty:Array<{paper_code:string;difficulty:string;attempted:number;correct:number;incorrect:number}>;
 consistency:DailyRow[];
};
type TrackerUnit={id:string;name:string;unit_number:number|null;total_questions:number;attempted_questions:number;remaining_questions:number;completion:number};
type TrackerPaper={paper_code:string;paper_name:string;subject_name:string;total_questions:number;attempted_questions:number;remaining_questions:number;completion:number;units:TrackerUnit[]};
type TrackerData={papers:TrackerPaper[]};
type SyllabusTopic={id:string;unit_id:string;name:string;total_questions:number;attempted_questions:number;remaining_questions:number;completion:number};
type RangeKey="today"|"week"|"month"|"3months"|"all"|"custom";
type ConsistencyKey="daily"|"weekly"|"monthly";

const pct=(v:number|null|undefined)=>Math.max(0,Math.min(100,Number(v)||0));
const completionTone=(v:number|null|undefined)=>{const n=pct(v);return n>=100?"complete":n>=75?"high":n>=40?"medium":n>0?"low":"none";};
const fmt=(v:number)=>Number(v||0).toLocaleString("en-IN");
const dateKey=(d:Date)=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");};
const startOfWeek=(d:Date)=>{const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;};
const labelDate=(s:string)=>new Date(s+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"});
const timeLabel=(s:number|null)=>s===null||s===undefined?"—":s<60?Math.round(s)+" sec":Math.floor(s/60)+"m "+Math.round(s%60)+"s";

export default function AnalyticsPage(){
 const router=useRouter();

 const [data,setData]=useState<AnalyticsData|null>(null);
 const [tracker,setTracker]=useState<TrackerData|null>(null);
 const [syllabusTopics,setSyllabusTopics]=useState<SyllabusTopic[]>([]);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState("");
 const [tab,setTab]=useState<"performance"|"syllabus">("performance");
 const [range,setRange]=useState<RangeKey>("month");
 const [from,setFrom]=useState("");
 const [to,setTo]=useState("");
 const [consistency,setConsistency]=useState<ConsistencyKey>("daily");
 const [expandedUnits,setExpandedUnits]=useState<string[]>([]);
 const [paperTab,setPaperTab]=useState("PAPER_1");
 const [analysisPaperTab,setAnalysisPaperTab]=useState("PAPER_1");


 const bounds=useMemo(()=>{
  const now=new Date();let start:Date|null=null,end:Date|null=null;
  if(range==="today"){start=new Date(now);start.setHours(0,0,0,0);}
  if(range==="week"){start=new Date(now);start.setDate(start.getDate()-6);start.setHours(0,0,0,0);}
  if(range==="month"){start=new Date(now);start.setDate(start.getDate()-29);start.setHours(0,0,0,0);}
  if(range==="3months"){start=new Date(now);start.setDate(start.getDate()-89);start.setHours(0,0,0,0);}
  if(range==="custom"){start=from?new Date(from+"T00:00:00"):null;end=to?new Date(to+"T23:59:59"):null;}
  return {from:start?.toISOString()??null,to:end?.toISOString()??null};
 },[range,from,to]);

 const load=useCallback(async(initial=false)=>{
  const db=createSupabaseBrowserClient();
  if(initial)setLoading(true);else setRefreshing(true);
  setError("");
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError||!auth.user){router.replace("/login");return;}
  const [analyticsResult,trackerResult,topicResult]=await Promise.all([
   db.rpc("student_get_analytics_v2",{p_from:bounds.from,p_to:bounds.to}),
   db.rpc("student_get_syllabus_tracker"),
   db.rpc("student_get_syllabus_topic_tracker")
  ]);
  if(analyticsResult.error){setError(analyticsResult.error.message||"Analytics could not be loaded.");setData(null);}
  else setData(analyticsResult.data as AnalyticsData);
  if(trackerResult.error){setError(current=>current||trackerResult.error.message||"Syllabus progress could not be loaded.");setTracker(null);}
  else setTracker(trackerResult.data as TrackerData);
  if(topicResult.error){setSyllabusTopics([]);}
  else setSyllabusTopics((topicResult.data||[]) as SyllabusTopic[]);
  setLoading(false);setRefreshing(false);
 },[router,bounds.from,bounds.to]);

 useEffect(()=>{void load(false);},[load]);
 const overall=data?.overall;
 const papers=data?.papers||[];
 const units=data?.units||[];
 const topics=data?.topics||[];
 const difficulty=data?.difficulty||[];
 const daily=data?.consistency||[];
 const startPractice=(paperCode:string,unitId?:string,difficultyValue?:string)=>{
  const paper=papers.find(p=>p.paper_code===paperCode);
  if(!paper)return;
  try{
   sessionStorage.setItem("mm-practice-paper-code",paperCode);
   if(unitId)sessionStorage.setItem("mm-practice-unit-id",unitId);else sessionStorage.removeItem("mm-practice-unit-id");
   if(difficultyValue)sessionStorage.setItem("mm-practice-difficulty",difficultyValue);else sessionStorage.removeItem("mm-practice-difficulty");
   router.push("/practice");
  }catch{router.push("/practice");}
 };
 const analysisPaper= papers.find(p=>p.paper_code===analysisPaperTab);
 const analysisUnits=units.filter(u=>u.paper_name===analysisPaper?.paper_name);
 const analysisUnitIds=new Set(analysisUnits.map(u=>u.id));
 const analysisTopics=topics.filter(t=>analysisUnitIds.has(t.unit_id));
 const analysisDifficulty=difficulty.filter(d=>d.paper_code===analysisPaperTab);
 const focusUnit=analysisUnits.find(u=>u.attempted===0)||[...analysisUnits].filter(u=>u.accuracy!==null).sort((a,b)=>Number(a.accuracy)-Number(b.accuracy))[0];
 const focusMessage=focusUnit?(focusUnit.attempted===0?focusUnit.name+" has not been started yet. Begin with a short practice set.":focusUnit.name+" has the most room to grow. Focus on accuracy and review incorrect answers."):"Complete a few practice questions to unlock your next focus area.";
 const selectedPaper=tracker?.papers.find(p=>p.paper_code===paperTab)||tracker?.papers[0];
 const totalSyllabus=tracker?.papers.reduce((n,p)=>n+p.total_questions,0)||0;
 const attemptedSyllabus=tracker?.papers.reduce((n,p)=>n+p.attempted_questions,0)||0;
 const syllabusPct=pct(totalSyllabus?attemptedSyllabus/totalSyllabus*100:0);

 const chartRows=useMemo(()=>{
  const buckets=new Map<string,Set<string>>();
  for(const row of daily){
   const d=new Date(row.activity_date+"T00:00:00");
   let key=row.activity_date;
   if(consistency==="weekly")key=dateKey(startOfWeek(d));
   if(consistency==="monthly")key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
   if(!buckets.has(key))buckets.set(key,new Set());
   for(const id of row.question_ids||[])buckets.get(key)!.add(id);
  }
  return Array.from(buckets.entries()).map(([key,ids])=>({key,label:consistency==="daily"?labelDate(key):consistency==="weekly"?"Week of "+labelDate(key):new Date(key+"-01T00:00:00").toLocaleDateString("en-IN",{month:"short",year:"2-digit"}),count:ids.size})).slice(consistency==="daily"?-14:consistency==="weekly"?-8:-6);
 },[daily,consistency]);

 const consistencyTotals=useMemo(()=>{
  const unique=new Set<string>();let activeDayCount=0;let eventCount=0;
  for(const row of daily){for(const id of row.question_ids||[])unique.add(id);eventCount+=Number(row.questions||0);if(Number(row.questions)>0)activeDayCount++;}
  const dates=daily.map(r=>r.activity_date).sort();
  const start=range==="today"?dateKey(new Date()):range==="custom"?(from||dates[0]):range==="week"?dateKey(new Date(Date.now()-6*86400000)):range==="month"?dateKey(new Date(Date.now()-29*86400000)):range==="3months"?dateKey(new Date(Date.now()-89*86400000)):dates[0];
  const end=range==="custom"?(to||dateKey(new Date())):dateKey(new Date());
  const days=start?Math.max(1,Math.floor((new Date(end+"T00:00:00").getTime()-new Date(start+"T00:00:00").getTime())/86400000)+1):0;
  return {unique:unique.size,average:days?eventCount/days:0,activeDayCount};
 },[daily,range,from,to]);

 const toggleUnit=(id:string)=>setExpandedUnits(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
 if(loading)return <MockMasterLoading variant="workspace" title="Preparing your analytics" message="Combining your completed tests and syllabus coverage."/>;
 return <main className="an-page">
  <StudentWorkspaceHeader/>
  <div className="an-wrap">
   <header className="an-heading">
    <div><span className="an-kicker">YOUR LEARNING INSIGHTS</span><h1>Analytics</h1><p>Understand your performance and track syllabus completion.</p></div>
    <div className="an-heading-actions">{tab==="performance"&&(<div className="an-filter-row"><label htmlFor="an-range">Date range</label><select id="an-range" value={range} onChange={e=>setRange(e.target.value as RangeKey)}><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option><option value="3months">Last 3 months</option><option value="all">All time</option><option value="custom">Custom range</option></select></div>)}<button className="an-refresh" type="button" aria-label="Refresh analytics" title="Refresh analytics" disabled={refreshing} onClick={()=>void load(false)}><RefreshCw size={17} className={refreshing?"an-spin":""}/></button></div>
   </header>
   <div className="an-tabs" role="tablist" aria-label="Analytics sections">
    <button type="button" role="tab" aria-selected={tab==="performance"} className={tab==="performance"?"active":""} onClick={()=>setTab("performance")}><Activity size={16}/> Performance</button>
    <button type="button" role="tab" aria-selected={tab==="syllabus"} className={tab==="syllabus"?"active":""} onClick={()=>setTab("syllabus")}><BookOpenCheck size={16}/> Syllabus Progress</button>
   </div>
   {error&&<div className="an-error" role="alert">{error}<button type="button" onClick={()=>void load(false)}>Retry</button></div>}
   {tab==="performance"&&<>
    {range==="custom"&&<div className="an-custom"><label>From <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To <input type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></label></div>}
    <section className="an-panel an-overview">
     <div className="an-panel-title"><div><span className="an-kicker">PERFORMANCE OVERVIEW</span><h2>Your overall accuracy</h2></div><Target size={19}/></div>
     <div className="an-overview-body">
      <div className="an-ring" style={{"--progress":String(pct(overall?.accuracy))} as React.CSSProperties}><div><strong>{overall?.accuracy===null||overall?.accuracy===undefined?"—":Number(overall.accuracy).toFixed(1)+"%"}</strong><small>Accuracy</small></div></div>
      <div className="an-overview-metrics">
       <div><strong>{fmt(overall?.unique_questions_attempted||0)}</strong><span>Unique Questions Attempted</span></div>
       <div><strong>{fmt(overall?.correct_answers||0)}</strong><span>Correct Answers</span></div>
       <div><strong>{timeLabel(overall?.average_time_per_question??null)}</strong><span>Average Time per Question</span></div>
      </div>
     </div>
    </section>

    <section className="an-panel">
     <div className="an-panel-title"><div><span className="an-kicker">STUDY ROUTINE</span><h2>Consistency Tracker</h2><p>Unique questions attempted in each time bucket.</p></div><CalendarDays size={19}/></div>
     <div className="an-consistency-controls"><div className="an-segments">{(["daily","weekly","monthly"] as ConsistencyKey[]).map(v=><button type="button" key={v} className={consistency===v?"active":""} onClick={()=>setConsistency(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}</div></div>
     <div className="an-consistency-summary"><div><strong>{fmt(consistencyTotals.unique)}</strong><span>Total unique questions</span></div><div><strong>{consistencyTotals.average.toFixed(1)}</strong><span>Average questions per calendar day</span></div></div>
     <div className="an-chart" role="img" aria-label={"Questions attempted "+consistency+" chart"}>
      {chartRows.length?chartRows.map(row=><div className="an-chart-col" key={row.key}><strong>{row.count}</strong><div className="an-chart-track"><span style={{height:(Math.max(...chartRows.map(x=>x.count),1)?Math.max(5,row.count/Math.max(...chartRows.map(x=>x.count),1)*100):5)+"%"}}/></div><small>{row.label}</small></div>):<div className="an-empty">No completed question activity in this date range.</div>}
     </div>
    </section>

    <section className="an-panel">
     <div className="an-panel-title"><div><span className="an-kicker">PAPER-WISE PERFORMANCE</span><h2>Accuracy by paper</h2><p>Paper 2 shows your selected subject.</p></div><BarChart3 size={19}/></div>
     <div className="an-paper-list">{papers.map(p=><div className="an-paper-row" key={p.paper_code}><div className="an-paper-label"><strong>{p.paper_code==="PAPER_2"?p.subject_name:p.paper_name}</strong><b>{p.accuracy===null?"—":Number(p.accuracy).toFixed(1)+"%"}</b></div><div className="an-progress"><span style={{width:pct(p.accuracy)+"%"}}/></div></div>)}</div>
     {!papers.length&&<div className="an-empty">Paper-wise data will appear after you complete a test.</div>}
    </section>

    <div className="an-focus-next"><span>FOCUS NEXT</span><p>{focusMessage}</p></div>

    <div className="an-analysis-selector" role="group" aria-label="Select paper for detailed analysis"><div className="an-analysis-paper-tabs">{papers.map(p=><button type="button" key={p.paper_code} aria-pressed={analysisPaperTab===p.paper_code} className={analysisPaperTab===p.paper_code?"active":""} onClick={()=>setAnalysisPaperTab(p.paper_code)}>{p.paper_code==="PAPER_2"?"Paper 2":"Paper 1"}</button>)}</div></div>
    <section className="an-panel">
     <div className="an-panel-title"><div><span className="an-kicker">DETAILED SYLLABUS ANALYSIS</span><h2>Unit-wise Performance</h2><p>Accuracy, correct and incorrect answers.</p></div></div>
     <div className="an-unit-list">{analysisUnits.map(u=><article className="an-unit" key={u.id}><div className="an-unit-head"><div><strong>{u.name}</strong><small>{u.paper_name}</small></div><b>{u.accuracy===null?"—":Number(u.accuracy).toFixed(1)+"%"}</b></div><small className={"an-unit-status "+(u.attempted===0?"idle":Number(u.accuracy)>=85?"strong":"needs")}>{u.attempted===0?"Not started":Number(u.accuracy)>=85?"Strong":"Needs work"}</small><div className="an-split-progress"><span className="correct" style={{width:(u.attempted?u.correct/u.attempted*100:0)+"%"}}/><span className="incorrect" style={{width:(u.attempted?u.incorrect/u.attempted*100:0)+"%"}}/></div><div className="an-unit-stats"><span>{fmt(u.correct)} correct</span><span>{fmt(u.incorrect)} incorrect</span><button type="button" className="an-practice-button" onClick={()=>startPractice(analysisPaperTab,u.id)}>Practice <BookOpenCheck size={13}/></button></div></article>)}</div>
     {!analysisUnits.length&&<div className="an-empty">Unit performance will appear after you attempt unit-tagged questions.</div>}
    </section>

    <section className="an-panel">
     <div className="an-panel-title"><div><span className="an-kicker">TOPIC-WISE PERFORMANCE</span><h2>Topic analysis</h2></div></div>
     {analysisTopics.length?<div className="an-topic-list">{analysisTopics.map(t=><div className="an-topic" key={t.id}><div><strong>{t.name}</strong><small>{t.unit_name}</small></div><b>{t.accuracy===null?"—":Number(t.accuracy).toFixed(1)+"%"}</b></div>)}</div>:<div className="an-empty">Topic-wise analysis is not available yet because questions in this paper are not mapped to topics. Once topic mapping is added, this section will populate automatically.</div>}
    </section>

    <section className="an-panel">
     <div className="an-panel-title"><div><span className="an-kicker">QUESTION DIFFICULTY</span><h2>Difficulty Analysis</h2><p>Correct and incorrect answers by difficulty.</p></div></div>
     <div className="an-difficulty">{analysisDifficulty.map(d=><div className="an-difficulty-row" key={d.paper_code+"-"+d.difficulty}><div className="an-difficulty-name">{d.difficulty.charAt(0).toUpperCase()+d.difficulty.slice(1)} <b>{d.attempted?((d.correct/d.attempted)*100).toFixed(1):"—"}%</b><small>{d.paper_code==="PAPER_1"?"Paper 1":"Paper 2"} · {fmt(d.attempted)} attempted</small></div><div className="an-difficulty-bars"><div className="an-split-progress"><span className="correct" style={{width:(d.attempted?d.correct/d.attempted*100:0)+"%"}}/><span className="incorrect" style={{width:(d.attempted?d.incorrect/d.attempted*100:0)+"%"}}/></div></div><div className="an-difficulty-values"><span>{fmt(d.correct)} correct</span><span>{fmt(d.incorrect)} incorrect</span><button type="button" className="an-practice-button" onClick={()=>startPractice(d.paper_code,undefined,d.difficulty)}>Practice <BookOpenCheck size={13}/></button></div></div>)}</div>
     {!analysisDifficulty.length&&<div className="an-empty">Difficulty analysis will appear after completed attempts.</div>}
    </section>
   </>}

   {tab==="syllabus"&&<section className="an-syllabus">
    <section className="an-panel an-syllabus-overview"><div className="an-panel-title"><div><span className="an-kicker">QUESTION COVERAGE</span><h2>Overall Syllabus Progress</h2><p>Correct and incorrect attempts both count towards completion.</p></div><BookOpenCheck size={19}/></div><div className="an-syllabus-total"><strong>{syllabusPct.toFixed(1)}%</strong><span>{fmt(attemptedSyllabus)} of {fmt(totalSyllabus)} unique approved questions attempted</span></div><div className={"an-progress an-progress-large completion-"+completionTone(syllabusPct)}><span style={{width:syllabusPct+"%"}}/></div><div className="an-remaining">{fmt(Math.max(0,totalSyllabus-attemptedSyllabus))} questions remaining</div></section>
    <div className="an-syllabus-paper-tabs">{(tracker?.papers||[]).map(p=><button type="button" key={p.paper_code} className={selectedPaper?.paper_code===p.paper_code?"active":""} onClick={()=>setPaperTab(p.paper_code)}><span>{p.paper_name}</span>{p.paper_code==="PAPER_2"&&<small>{p.subject_name}</small>}</button>)}</div>
    {selectedPaper&&<section className="an-panel"><div className="an-panel-title"><div><span className="an-kicker">{selectedPaper.paper_name.toUpperCase()}</span><h2>{selectedPaper.subject_name}</h2><p>{fmt(selectedPaper.total_questions)} approved questions in this paper.</p></div><strong className="an-paper-completion">{pct(selectedPaper.completion).toFixed(1)}%</strong></div><div className={"an-progress an-progress-large completion-"+completionTone(selectedPaper.completion)}><span style={{width:pct(selectedPaper.completion)+"%"}}/></div><div className="an-unit-list an-syllabus-units">{selectedPaper.units.map((u,index)=>{const status=u.completion>=100?"Completed":u.completion>0?"In Progress":"Not Started";const open=expandedUnits.includes(u.id);return <article className="an-syllabus-unit" key={u.id}><button type="button" className="an-syllabus-unit-toggle" aria-expanded={open} onClick={()=>toggleUnit(u.id)}><span className="an-syllabus-unit-number">{u.unit_number??index+1}</span><span className="an-syllabus-unit-main"><strong>{u.name}</strong><small>{fmt(u.attempted_questions)} / {fmt(u.total_questions)} questions attempted · {fmt(u.remaining_questions)} remaining</small></span><span className={"an-status "+(status==="Completed"?"done":status==="In Progress"?"progress":"idle")}>{status}</span><b>{pct(u.completion).toFixed(1)}%</b><ChevronDown size={16} className={open?"turned":""}/></button><div className={"an-progress completion-"+completionTone(u.completion)}><span style={{width:pct(u.completion)+"%"}}/></div>{open&&<div className="an-topic-expand"><strong>Topic-wise question coverage</strong>{syllabusTopics.some(t=>t.unit_id===u.id)?<div className="an-topic-coverage-list">{syllabusTopics.filter(t=>t.unit_id===u.id).map(t=><div className="an-topic-coverage" key={t.id}><div><span>{t.name}</span><small>{fmt(t.attempted_questions)} / {fmt(t.total_questions)} attempted · {fmt(t.remaining_questions)} remaining</small></div><b>{pct(t.completion).toFixed(1)}%</b><div className={"an-progress completion-"+completionTone(t.completion)}><span style={{width:pct(t.completion)+"%"}}/></div></div>)}</div>:<p>Topic mapping is not available for this unit yet. Once questions are assigned to topics, topic completion will appear here.</p>}</div>}</article>})}</div></section>}
    <p className="an-footnote">Each approved question is counted once, even if you attempt it multiple times. Completion is based on unique question IDs, not accuracy.</p>
   </section>}
   <footer className="an-footer"><span>© {new Date().getFullYear()} MockMaster</span><span>Practice. Improve. Achieve.</span></footer>
  </div>
 </main>;
}
