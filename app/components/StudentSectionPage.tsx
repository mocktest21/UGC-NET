"use client";
import Link from "next/link";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {CalendarDays,Clock3,FileQuestion,Users,Trophy,Medal} from "lucide-react";
import StudentWorkspaceHeader from "@/components/navigation/StudentWorkspaceHeader";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";

type Section="practice"|"live-test"|"personal-notebook";
type LiveTest={id:string;title:string;description:string|null;duration_seconds:number;total_marks:number;starts_at:string;ends_at:string;question_count:number};
type LiveOverview={participant_count:number;my_score:number|null;my_rank:number|null;my_attempt_status:string|null};

const content={practice:{title:"Practice centre",subtitle:"Your selected papers and subjects, ready for focused practice."},"live-test":{title:"Live tests",subtitle:"Find your scheduled mock tests and attempt them within the test window."},"personal-notebook":{title:"Personal notebook",subtitle:"Keep your important learning points and revision notes in one place."}};
function formatCountdown(target:number,now:number){
 const seconds=Math.max(0,Math.floor((target-now)/1000));
 const hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),secs=seconds%60;
 return [hours,minutes,secs].map(value=>String(value).padStart(2,"0")).join(":");
}
export default function StudentSectionPage({section}:{section:Section}){
 const router=useRouter();
 const [name,setName]=useState("Student"),[loading,setLoading]=useState(true),[completedTests,setCompletedTests]=useState<LiveTest[]>([]),[liveTests,setLiveTests]=useState<LiveTest[]>([]),[overview,setOverview]=useState<Record<string,LiveOverview>>({}),[startingTest,setStartingTest]=useState(""),[error,setError]=useState(""),[currentTime,setCurrentTime]=useState(()=>Date.now());
 useEffect(()=>{if(section!=="live-test")return;const timer=window.setInterval(()=>setCurrentTime(Date.now()),1000);return()=>window.clearInterval(timer);},[section]);
 useEffect(()=>{let active=true;void(async()=>{
  const db=createSupabaseBrowserClient();
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError){if(active){setError("Could not verify your sign-in. Please retry.");setLoading(false);}return;}
  if(!auth.user){router.replace("/login");return;}
  const fullName=(auth.user.user_metadata?.full_name as string)||"Student";
  if(active)setName(fullName.trim().split(/\s+/)[0]||"Student");
  if(section==="practice"||section==="live-test"){
   const {data:preferences,error:preferenceError}=await db.from("student_exam_preferences")
     .select("exam_id").eq("student_id",auth.user.id);
   if(preferenceError&&active)setError(preferenceError.message);
   const examIds=Array.from(new Set((preferences||[]).map((row:any)=>row.exam_id).filter(Boolean)));
   {
    const now=new Date().toISOString();
    const baseQuery=db.from("tests")
      .select("id,title,description,duration_seconds,total_marks,starts_at,ends_at")
      .eq("mode","live").eq("status","published");
    // Keep exam-specific filtering when preferences exist; otherwise show all
    // published live tests so students without a saved preference can see them.
    const query=examIds.length?baseQuery.in("exam_id",examIds):baseQuery;
    const {data:liveRows,error:liveError}=section==="live-test"
      ?await query.order("starts_at",{ascending:false}).limit(100)
      :await query.lte("ends_at",now).order("ends_at",{ascending:false}).limit(50);
    if(liveError&&active)setError(liveError.message);
    const liveIds=(liveRows||[]).map((test:any)=>test.id);
    const questionCounts:Record<string,number>={};
    if(liveIds.length){
      const {data:questionLinks,error:questionError}=await db.from("test_questions").select("test_id").in("test_id",liveIds);
      if(questionError&&active)setError(questionError.message);
      for(const link of questionLinks||[])questionCounts[link.test_id]=(questionCounts[link.test_id]||0)+1;
    }
    const mapped=(liveRows||[]).map((test:any)=>({...test,question_count:questionCounts[test.id]||0})).filter((test:any)=>test.question_count>0) as LiveTest[];
    if(section==="practice"){
      if(active)setCompletedTests(mapped);
    }else{
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
   }
  }
  if(active)setLoading(false);
 })().catch(e=>{if(active){setError(e instanceof Error?e.message:"Unable to load your workspace.");setLoading(false);}});
 return()=>{active=false;};},[router,section]);
 if(loading)return <main className="mm-loading"><span className="mm-loading-mark">M</span><p>Loading your MockMaster workspace...</p></main>;
 const page=content[section];
 return <main className="mm-workspace-page">
  <StudentWorkspaceHeader name={name}/>
  <section className="mm-workspace-content">
   <div className="mm-workspace-intro"><span>MOCKMASTER WORKSPACE</span><h1>{page.title}</h1><p>{page.subtitle}</p>{section==="practice"&&<Link className="mm-practice-builder-cta" href="/practice/build-test"><strong>＋ Build your own test</strong><span>Choose units, question count and duration →</span></Link>}</div>
   {section==="practice"&&<div className="mm-practice-dashboard">
    <div className="mm-practice-section-heading"><div><span>READY-MADE PRACTICE</span><h2>Previous Live Tests</h2><p>Completed live tests are available here to practise again.</p></div><span className="mm-practice-count">{completedTests.length} available</span></div>
    {error&&<div className="mm-workspace-error" role="alert">{error} <button type="button" onClick={()=>window.location.reload()}>Retry</button></div>}
    {completedTests.length?<div className="mm-completed-live-grid mm-practice-live-grid">{completedTests.map(test=><article className="mm-completed-live-card" key={test.id}>
      <div className="mm-live-card-top"><span className="mm-live-status is-completed"><i/>COMPLETED</span><span className="mm-live-card-mark">{Number(test.total_marks).toLocaleString("en-IN")} Marks</span></div>
      <h3>{test.title}</h3>
      {test.description&&<p className="mm-live-card-description">{test.description}</p>}
      <div className="mm-live-card-stats"><span><FileQuestion size={14}/>{test.question_count} Qs</span><span><Clock3 size={14}/>{Math.ceil(test.duration_seconds/60)} min</span></div>
      <button type="button" disabled={startingTest===test.id} onClick={async()=>{
        setError("");setStartingTest(test.id);
        const db=createSupabaseBrowserClient();
        const {data,error}=await db.rpc("student_start_completed_live_test",{p_source_live_test_id:test.id});
        setStartingTest("");
        if(error){setError(error.message);return;}
        const result=data as {test_id:string;attempt_id:string;duration_seconds:number};
        router.push("/practice/session?"+new URLSearchParams({test:result.test_id,attempt:result.attempt_id,minutes:String(Math.ceil(result.duration_seconds/60))}).toString());
      }}><span>{startingTest===test.id?"Preparing…":"Practice again"}</span></button>
    </article>)}</div>:<div className="mm-workspace-empty mm-completed-live-empty"><span><Clock3 size={22}/></span><h2>No completed live tests yet</h2><p>Once a scheduled live test ends, it will automatically appear here as a ready-made practice test.</p></div>}
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
          <div className="mm-live-card-top"><span className={kind==="active"?"mm-live-status is-live":kind==="recent"?"mm-live-status is-completed":"mm-live-status"}><i/>{kind==="active"?"LIVE NOW":kind==="recent"?(stats.my_attempt_status==="submitted"||stats.my_attempt_status==="auto_submitted"?"COMPLETED":"MISSED"):"UPCOMING"}</span><span className="mm-live-card-mark">{Number(test.total_marks).toLocaleString("en-IN")} Marks</span></div>
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
            if(error){setError(error.message);return;}
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
