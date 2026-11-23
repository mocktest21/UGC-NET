"use client";
import Link from "next/link";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {CalendarDays,Clock3,FileQuestion,Users,Trophy,Medal,Sparkles,Lock,Target,Zap,Play,Layers,Bookmark,Shuffle,BookOpen} from "lucide-react";
import StudentWorkspaceHeader from "@/components/navigation/StudentWorkspaceHeader";
import MockMasterLoading from "@/app/components/ui/MockMasterLoading";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";

type Section="practice"|"live-test"|"personal-notebook";
type LiveTest={id:string;title:string;description:string|null;duration_seconds:number;total_marks:number;starts_at:string;ends_at:string;question_count:number};
type LiveOverview={participant_count:number;my_score:number|null;my_rank:number|null;my_attempt_status:string|null};
type FullLengthTest={id:string;title:string;description:string|null;duration_seconds:number;total_marks:number};

const content={practice:{title:"Practice Centre",subtitle:"Build your own tests, revise challenging questions and prepare with exam-style mock tests."},"live-test":{title:"Live tests",subtitle:"Find your scheduled mock tests and attempt them within the test window."},"personal-notebook":{title:"Personal notebook",subtitle:"Keep your important learning points and revision notes in one place."}};
function formatCountdown(target:number,now:number){
 const seconds=Math.max(0,Math.floor((target-now)/1000));
 const hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),secs=seconds%60;
 return [hours,minutes,secs].map(value=>String(value).padStart(2,"0")).join(":");
}
export default function StudentSectionPage({section}:{section:Section}){
 const router=useRouter();
 const [name,setName]=useState("Student"),[loading,setLoading]=useState(true),[liveTests,setLiveTests]=useState<LiveTest[]>([]),[overview,setOverview]=useState<Record<string,LiveOverview>>({}),[startingTest,setStartingTest]=useState(""),[startingSmartQuiz,setStartingSmartQuiz]=useState(false),[smartQuizCount,setSmartQuizCount]=useState(0),[error,setError]=useState(""),[currentTime,setCurrentTime]=useState(()=>Date.now()),[quickDistribution,setQuickDistribution]=useState<any>(null),[quickPopup,setQuickPopup]=useState(false),[quickKind,setQuickKind]=useState(""),[quickCountdown,setQuickCountdown]=useState<number|null>(null),[quickBusy,setQuickBusy]=useState(false),[fullLengthTests,setFullLengthTests]=useState<FullLengthTest[]>([]),[startingFullLength,setStartingFullLength]=useState("");
 useEffect(()=>{if(quickCountdown===null)return;if(quickCountdown>0){const timer=window.setTimeout(()=>setQuickCountdown(value=>value===null?null:value-1),1000);return()=>window.clearTimeout(timer);}if(quickCountdown===0&&quickKind){void(async()=>{setQuickBusy(true);setError("");const db=createSupabaseBrowserClient();const {data,error}=await db.rpc("student_start_quick_practice",{p_kind:quickKind});setQuickBusy(false);setQuickCountdown(null);setQuickPopup(false);if(error){setError(error.message);return;}const result=data as {test_id:string;attempt_id:string;duration_seconds:number};router.push("/practice/session?"+new URLSearchParams({test:result.test_id,attempt:result.attempt_id,minutes:String(Math.ceil(result.duration_seconds/60))}).toString());})();}},[quickCountdown,quickKind,router]);
 async function handleQuickPractice(kind:string){setError("");setQuickKind(kind);if(kind==="twenty"){setQuickBusy(true);const db=createSupabaseBrowserClient();const {data,error}=await db.rpc("student_get_quick_practice_distribution",{p_question_count:20});setQuickBusy(false);if(error){setError(error.message);return;}setQuickDistribution(data);setQuickPopup(true);return;}setQuickCountdown(0);}
 useEffect(()=>{if(section!=="live-test")return;const timer=window.setInterval(()=>setCurrentTime(Date.now()),1000);return()=>window.clearInterval(timer);},[section]);
 useEffect(()=>{let active=true;void(async()=>{
  const db=createSupabaseBrowserClient();
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError){if(active){setError("Could not verify your sign-in. Please retry.");setLoading(false);}return;}
  if(!auth.user){router.replace("/login");return;}
  const fullName=(auth.user.user_metadata?.full_name as string)||"Student";
  if(active)setName(fullName.trim().split(/\s+/)[0]||"Student");
  if(section==="practice"){
   const {data:notebook,error:notebookError}=await db.rpc("student_get_personal_notebook");
   if(notebookError&&active)setError(notebookError.message);
   if(active&&!notebookError)setSmartQuizCount(Array.isArray((notebook as any)?.incorrect)?(notebook as any).incorrect.length:0);
  }
  if(section==="live-test"){
   const {data:preferences,error:preferenceError}=await db.from("student_exam_preferences")
     .select("exam_id").eq("student_id",auth.user.id);
   if(preferenceError&&active)setError(preferenceError.message);
   const examIds=Array.from(new Set((preferences||[]).map((row:any)=>row.exam_id).filter(Boolean)));
   const baseQuery=db.from("tests")
     .select("id,title,description,duration_seconds,total_marks,starts_at,ends_at")
     .eq("mode","live").eq("status","published");
   // Keep exam-specific filtering when preferences exist; otherwise show all
   // published live tests so students without a saved preference can see them.
   const query=examIds.length?baseQuery.in("exam_id",examIds):baseQuery;
   const {data:liveRows,error:liveError}=await query.order("starts_at",{ascending:false}).limit(100);
   if(liveError&&active)setError(liveError.message);
   const liveIds=(liveRows||[]).map((test:any)=>test.id);
   const questionCounts:Record<string,number>={};
   if(liveIds.length){
    const {data:countRows,error:questionError}=await db.rpc("student_get_live_test_question_counts",{p_test_ids:liveIds});
    if(questionError&&active)setError(questionError.message);
    for(const row of countRows||[])questionCounts[row.test_id]=Number(row.question_count||0);
   }
   const mapped=(liveRows||[]).map((test:any)=>({...test,question_count:questionCounts[test.id]||0})).filter((test:any)=>test.question_count>0) as LiveTest[];
   if(active)setLiveTests(mapped);
   if(mapped.length){
    const {data:stats,error:statsError}=await db.rpc("student_get_live_test_overview",{p_test_ids:mapped.map(test=>test.id)});
    if(statsError&&active)setError(statsError.message);
    if(active&&!statsError){
     const summary:Record<string,LiveOverview>={};
     for(const item of stats||[])summary[item.test_id]={participant_count:Number(item.participant_count||0),my_score:item.my_score===null?null:Number(item.my_score),my_rank:item.my_rank===null?null:Number(item.my_rank),my_attempt_status:item.my_attempt_status||null};
     setOverview(summary);
    }
   }
  }
  if(active)setLoading(false);
 })().catch(e=>{if(active){setError(e instanceof Error?e.message:"Unable to load your workspace.");setLoading(false);}});
 return()=>{active=false;};},[router,section]);
 if(loading)return <MockMasterLoading variant={section==="practice"?"builder":section==="personal-notebook"?"notebook":"workspace"} title={section==="practice"?"Preparing your practice centre":section==="live-test"?"Loading scheduled tests":"Opening your personal notebook"}/>;
 const page=content[section];
 return <main className="mm-workspace-page">
  <StudentWorkspaceHeader name={name}/>
  <section className="mm-workspace-content">
   {section!=="practice"&&<div className="mm-workspace-intro"><span>MOCKMASTER WORKSPACE</span><h1>{page.title}</h1><p>{page.subtitle}</p></div>}
   {section==="practice"&&<div className="mm-practice-v2">
    <div className="mm-practice-v2-hero">
     <div><span>MOCKMASTER WORKSPACE</span><h1>Practice Centre</h1><p>Build tests, revise mistakes, practise PYQs and prepare for the real exam.</p></div>
     <div className="mm-practice-v2-art" aria-hidden="true"><FileQuestion size={42}/><Sparkles size={18}/></div>
    </div>

    <section className="mm-practice-v2-quick">
     <div className="mm-practice-v2-heading"><h2><Zap size={17}/> Quick practice</h2><Link href="/practice/build-test">Custom practice →</Link></div>
     {error&&<div className="mm-workspace-error" role="alert">{error}</div>}
     <div className="mm-practice-v2-quick-scroll">
      <button type="button" disabled={quickBusy||quickCountdown!==null} onClick={()=>void handleQuickPractice("ten")}><Play size={17}/><strong>10 Qs</strong><small>10 min</small></button>
      <button type="button" disabled={quickBusy||quickCountdown!==null} onClick={()=>void handleQuickPractice("twenty")}><Layers size={17}/><strong>20 Qs</strong><small>20 min</small></button>
      <button type="button" disabled={quickBusy||quickCountdown!==null} onClick={()=>void handleQuickPractice("bookmarked")}><Bookmark size={17}/><strong>Bookmarked</strong><small>Up to 20</small></button>
      <button type="button" disabled={quickBusy||quickCountdown!==null} onClick={()=>void handleQuickPractice("surprise")}><Shuffle size={17}/><strong>Surprise me</strong><small>10–30 · Mixed</small></button>
     </div>
     {quickCountdown!==null&&<div className="mm-quick-countdown" role="status">{quickCountdown>0?<>Test starts in <b>{quickCountdown}</b>…</>:"Preparing your test…"}</div>}
     {quickPopup&&<div className="mm-quick-modal-backdrop" role="presentation"><section className="mm-quick-modal" role="dialog" aria-modal="true" aria-labelledby="mm-quick-modal-title">
      <button className="mm-quick-modal-close" type="button" onClick={()=>setQuickPopup(false)} aria-label="Close">×</button>
      <span className="mm-quick-modal-kicker">YOUR RANDOM SET</span><h2 id="mm-quick-modal-title">20 Questions · Distribution</h2>
      <p>{quickDistribution?.selected??20} questions selected from the approved question bank.</p>
      <div className="mm-quick-distribution-group"><h3>Paper-wise</h3>{(quickDistribution?.papers||[]).map((item:any)=><div key={item.name}><span>{item.name}</span><b>{item.count}</b></div>)}</div>
      <div className="mm-quick-distribution-group"><h3>Unit-wise</h3>{(quickDistribution?.units||[]).map((item:any)=><div key={item.name}><span>{item.name}</span><b>{item.count}</b></div>)}</div>
      <div className="mm-quick-distribution-group"><h3>Source-wise</h3>{(quickDistribution?.sources||[]).map((item:any)=><div key={item.name}><span>{item.name}</span><b>{item.count}</b></div>)}</div>
      <button className="mm-quick-start-now" type="button" disabled={quickBusy} onClick={()=>{setQuickPopup(false);setQuickCountdown(5);}}>Start Now →</button>
     </section></div>}
    </section>
    <section className="mm-practice-v2-card-list">
     <button type="button" className="mm-practice-v2-feature-card smart-card" disabled={startingSmartQuiz||smartQuizCount===0} onClick={async()=>{setError("");setStartingSmartQuiz(true);const db=createSupabaseBrowserClient();const {data,error}=await db.rpc("student_start_smart_quiz");setStartingSmartQuiz(false);if(error){setError(error.message);return;}const result=data as {test_id:string;attempt_id:string;duration_seconds:number};router.push("/practice/session?"+new URLSearchParams({test:result.test_id,attempt:result.attempt_id,minutes:String(Math.ceil(result.duration_seconds/60))}).toString());}}>
      <span className="mm-practice-v2-feature-icon"><Sparkles size={28}/></span><span className="mm-practice-v2-feature-copy"><strong>Smart Quiz</strong><small>Revise your incorrect answers and weakest units.</small></span><span className="mm-practice-v2-feature-status smart-count">{startingSmartQuiz?"…":smartQuizCount+" to revise"}</span><b className="mm-practice-v2-feature-arrow">›</b>
     </button>
     <section className="mm-practice-v2-more">
      <h2>More ways to practise</h2>
      <Link href="/practice/build-test" className="mm-practice-v2-feature-card way-build">
       <span className="mm-practice-v2-feature-icon"><FileQuestion size={28}/></span><span className="mm-practice-v2-feature-copy"><strong>Build Your Own Test</strong><small>Pick paper, units, source, questions and time.</small></span><b className="mm-practice-v2-feature-arrow">›</b>
      </Link>
      <div className="mm-practice-v2-feature-card way-daily is-planned">
       <span className="mm-practice-v2-feature-icon"><CalendarDays size={28}/></span><span className="mm-practice-v2-feature-copy"><strong>Daily Challenge</strong><small>A short, focused quiz to build consistency.</small></span><em className="mm-practice-v2-feature-status">Soon</em><b className="mm-practice-v2-feature-arrow">›</b>
      </div>
      <div className="mm-practice-v2-feature-card way-pyq is-planned">
       <span className="mm-practice-v2-feature-icon"><BookOpen size={28}/></span><span className="mm-practice-v2-feature-copy"><strong>PYQ Practice</strong><small>Previous year questions, unit-wise or year-wise.</small></span><em className="mm-practice-v2-feature-status">Soon</em><b className="mm-practice-v2-feature-arrow">›</b>
      </div>
      <Link href="/personal-notebook" className="mm-practice-v2-feature-card way-saved">
       <span className="mm-practice-v2-feature-icon"><Bookmark size={28}/></span><span className="mm-practice-v2-feature-copy"><strong>My Saved Questions</strong><small>Revise your bookmarked questions anytime.</small></span><b className="mm-practice-v2-feature-arrow">›</b>
      </Link>
     </section>
    </section>
    <section className="mm-practice-v2-premium mm-full-length-section">
     <div><span>UGC NET MOCK EXAMS</span><small> Paper 1 + Paper 2 · 180 minutes</small></div>
     <h2>Full-Length Mock Tests</h2><p>Attempt the complete exam with 50 Paper 1 and 100 Paper 2 questions.</p>
     {fullLengthTests.length===0?<div className="mm-live-empty-inline">No Full-Length Tests published yet.</div>:<div className="mm-completed-live-grid mm-full-length-grid">{fullLengthTests.map(test=><article className="mm-completed-live-card" key={test.id}>
      <div className="mm-live-card-top"><span className="mm-live-status"><i/>AVAILABLE</span><span className="mm-live-card-mark">{Number(test.total_marks).toLocaleString("en-IN")} Marks</span></div>
      <h3>{test.title}</h3>{test.description&&<p className="mm-live-card-description">{test.description}</p>}
      <div className="mm-live-card-stats"><span><FileQuestion size={14}/>150 Questions</span><span><Clock3 size={14}/>180 min</span></div>
      <button type="button" disabled={startingFullLength===test.id} onClick={async()=>{
       setError("");setStartingFullLength(test.id);const db=createSupabaseBrowserClient();
       const {data,error}=await db.rpc("student_start_full_length_test",{p_test_id:test.id});setStartingFullLength("");
       if(error){setError(error.message);return;}
       const result=data as {test_id:string;attempt_id:string;duration_seconds:number};
       router.push("/practice/session?"+new URLSearchParams({test:result.test_id,attempt:result.attempt_id,minutes:String(Math.ceil(result.duration_seconds/60))}).toString());
      }}>{startingFullLength===test.id?"Preparing…":"Start Full-Length Test"}</button>
     </article>)}</div>}
    </section>


   </div>}
   {section==="live-test"&&<div className="mm-practice-dashboard mm-live-dashboard">
    {error&&<div className="mm-workspace-error" role="alert">{error} <button type="button" onClick={()=>window.location.reload()}>Retry</button></div>}
    {(()=>{
      const upcoming=liveTests.filter(test=>new Date(test.starts_at).getTime()>currentTime).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
      const active=liveTests.filter(test=>new Date(test.starts_at).getTime()<=currentTime&&new Date(test.ends_at).getTime()>currentTime).sort((a,b)=>a.ends_at.localeCompare(b.ends_at));
      const recent=liveTests.filter(test=>new Date(test.ends_at).getTime()<=currentTime).sort((a,b)=>b.ends_at.localeCompare(a.ends_at)).slice(0,10);
      const card=(test:LiveTest,kind:"upcoming"|"active"|"recent")=>{
        const stats=overview[test.id]||{participant_count:0,my_score:null,my_rank:null,my_attempt_status:null};
        const starts=new Date(test.starts_at).getTime(),ends=new Date(test.ends_at).getTime();
        const ended=kind==="recent";
        return <article className="mm-completed-live-card mm-live-lifecycle-card" key={test.id}>
          <div className="mm-live-card-top"><span className={kind==="active"?"mm-live-status is-live":kind==="recent"?(stats.my_attempt_status==="submitted"||stats.my_attempt_status==="auto_submitted"?"mm-live-status is-completed":"mm-live-status is-missed"):"mm-live-status"}><i/>{kind==="active"?"LIVE NOW":kind==="recent"?(stats.my_attempt_status==="submitted"||stats.my_attempt_status==="auto_submitted"?"COMPLETED":"MISSED"):"UPCOMING"}</span><span className="mm-live-card-mark">{Number(test.total_marks).toLocaleString("en-IN")} Marks</span></div>
          <h3>{test.title}</h3>
          {test.description&&<p className="mm-live-card-description">{test.description}</p>}
          <div className="mm-live-card-stats"><span><FileQuestion size={14}/>{test.question_count} Qs</span><span><Clock3 size={14}/>{Math.ceil(test.duration_seconds/60)} min</span></div>
          <div className="mm-live-participants"><Users size={14}/><span>{stats.participant_count} participants</span></div>
          {kind==="upcoming"&&<div className="mm-live-lifecycle-foot"><span>Opens in <b>{formatCountdown(starts,currentTime)}</b></span><span className="mm-live-schedule"><CalendarDays size={13}/>{new Date(starts).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}</span></div>}
          {kind==="active"&&<div className="mm-live-lifecycle-foot is-live"><span>Ends in <b>{formatCountdown(ends,currentTime)}</b></span><span className="mm-live-schedule"><CalendarDays size={13}/>{new Date(ends).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}</span></div>}
          {kind==="recent"&&<div className="mm-live-recent-summary">
            <span><CalendarDays size={13}/>{new Date(ends).toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span>
            <span>{stats.my_score!==null?<>Your score <b>{stats.my_score} / {Number(test.total_marks).toLocaleString("en-IN")}</b></>:"No score recorded"}</span>
            {stats.my_rank!==null&&<span><Medal size={13}/> Rank <b>#{stats.my_rank}</b></span>}
          </div>}
          {kind==="upcoming"&&<div className="mm-live-action-placeholder">Scheduled test</div>}
          {kind==="active"&&<button type="button" disabled={startingTest===test.id} onClick={async()=>{
            setError("");setStartingTest(test.id);
            const db=createSupabaseBrowserClient();
            const {data,error}=await db.rpc("student_start_live_test",{p_test_id:test.id});
            setStartingTest("");
            const result=data as {test_id:string;attempt_id:string;duration_seconds:number};
            router.push("/practice/session?"+new URLSearchParams({test:result.test_id,attempt:result.attempt_id,minutes:String(Math.ceil(result.duration_seconds/60))}).toString());
          }}><span>{startingTest===test.id?"Preparing…":"Start test"}</span></button>}
          {kind==="recent"&&<button type="button" onClick={()=>router.push("/live-test/leaderboard?"+new URLSearchParams({test:test.id}).toString())}> <Trophy size={14}/> View leaderboard</button>}
        </article>;
      };
      return <>
        <section className="mm-live-lifecycle-section">
          <div className="mm-practice-section-heading"><div><span>TEST SCHEDULE</span><h2>Upcoming Tests</h2><p>Get ready for your next scheduled mock test.</p></div><span className="mm-practice-count">{upcoming.length} upcoming</span></div>
          {upcoming.length?<div className="mm-completed-live-grid mm-live-lifecycle-grid">{upcoming.map(test=>card(test,"upcoming"))}</div>:<div className="mm-live-empty-inline">No upcoming tests scheduled.</div>}
        </section>
        <section className="mm-live-lifecycle-section">
          <div className="mm-practice-section-heading"><div><span>ATTEMPT NOW</span><h2>Live Now</h2><p>These tests are currently open for attempts.</p></div><span className="mm-practice-count">{active.length} live</span></div>
          {active.length?<div className="mm-completed-live-grid mm-live-lifecycle-grid">{active.map(test=>card(test,"active"))}</div>:<div className="mm-live-empty-inline">No tests are live right now.</div>}
        </section>
        <section className="mm-live-lifecycle-section">
          <div className="mm-practice-section-heading"><div><span>PAST SCHEDULES</span><h2>Recent Tests</h2><p>Check your score and compare your rank with other students.</p></div><span className="mm-practice-count">{recent.length} recent</span></div>
          {recent.length?<div className="mm-completed-live-grid mm-live-lifecycle-grid">{recent.map(test=>card(test,"recent"))}</div>:<div className="mm-live-empty-inline">Completed and missed tests will appear here.</div>}
        </section>
      </>;
    })()}
   </div>}
   {section==="personal-notebook"&&<div className="mm-workspace-empty"><span>✎</span><h2>Your notebook is ready</h2><p>Saved notes and bookmarked questions will appear here.</p></div>}
  </section><footer className="mm-workspace-footer">© {new Date().getFullYear()} MockMaster <span>Practice. Improve. Achieve.</span></footer>
 </main>;
}
