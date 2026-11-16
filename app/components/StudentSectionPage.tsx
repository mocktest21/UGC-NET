"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {CalendarDays,Clock3,FileQuestion} from "lucide-react";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";

type Section="practice"|"live-test"|"personal-notebook";
type LiveTest={id:string;title:string;description:string|null;duration_seconds:number;total_marks:number;starts_at:string;ends_at:string;question_count:number};
const links=[{label:"Dashboard",href:"/dashboard"},{label:"Practice",href:"/practice"},{label:"Live Test",href:"/live-test"},{label:"Personal Notebook",href:"/personal-notebook"},{label:"About Us",href:"/About"}];
const content={practice:{title:"Practice centre",subtitle:"Your selected papers and subjects, ready for focused practice."},"live-test":{title:"Live tests",subtitle:"Find your scheduled mock tests and attempt them within the test window."},"personal-notebook":{title:"Personal notebook",subtitle:"Keep your important learning points and revision notes in one place."}};
function formatCountdown(target:number,now:number){
 const seconds=Math.max(0,Math.floor((target-now)/1000));
 const hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),secs=seconds%60;
 return [hours,minutes,secs].map(value=>String(value).padStart(2,"0")).join(":");
}
export default function StudentSectionPage({section}:{section:Section}){
 const router=useRouter();
 const [name,setName]=useState("Student"),[loading,setLoading]=useState(true),[completedTests,setCompletedTests]=useState<LiveTest[]>([]),[startingTest,setStartingTest]=useState(""),[error,setError]=useState(""),[currentTime,setCurrentTime]=useState(()=>Date.now());
 useEffect(()=>{if(section!=="live-test")return;const timer=window.setInterval(()=>setCurrentTime(Date.now()),1000);return()=>window.clearInterval(timer);},[section]);
 useEffect(()=>{let active=true;void(async()=>{
  const db=createSupabaseBrowserClient();
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError||!auth.user){router.replace("/login");return;}
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
      ?await query.order("starts_at",{ascending:true}).limit(100)
      :await query.lte("ends_at",now).order("ends_at",{ascending:false}).limit(50);
    if(liveError&&active)setError(liveError.message);
    const liveIds=(liveRows||[]).map((test:any)=>test.id);
    const questionCounts:Record<string,number>={};
    if(liveIds.length){
      const {data:questionLinks,error:questionError}=await db.from("test_questions").select("test_id").in("test_id",liveIds);
      if(questionError&&active)setError(questionError.message);
      for(const link of questionLinks||[])questionCounts[link.test_id]=(questionCounts[link.test_id]||0)+1;
    }
    if(active)setCompletedTests((liveRows||[]).map((test:any)=>({...test,question_count:questionCounts[test.id]||0})).filter((test:any)=>test.question_count>0));
   }
  }
  if(active)setLoading(false);
 })().catch(e=>{if(active){setError(e instanceof Error?e.message:"Unable to load your workspace.");setLoading(false);}});
 return()=>{active=false;};},[router,section]);
 if(loading)return <main className="mm-loading"><span className="mm-loading-mark">M</span><p>Loading your MockMaster workspace...</p></main>;
 const page=content[section];
 return <main className="mm-workspace-page">
  <header className="mm-workspace-header"><a className="mm-brand" href="/"><span className="mm-brand-mark">M</span><span>MockMaster</span></a><nav aria-label="Main navigation" className="mm-workspace-nav">{links.map(link=><a key={link.href} href={link.href} className={link.href==="/"+section?"active":""}>{link.label}</a>)}</nav><span className="mm-workspace-user">Hey, {name}!</span></header>
  <section className="mm-workspace-content">
   <div className="mm-workspace-intro"><span>MOCKMASTER WORKSPACE</span><h1>{page.title}</h1><p>{page.subtitle}</p>{section==="practice"&&<a className="mm-practice-builder-cta" href="/practice/build-test"><strong>＋ Build your own test</strong><span>Choose units, question count and duration →</span></a>}</div>
   {section==="practice"&&<div className="mm-practice-dashboard">
    <div className="mm-practice-section-heading"><div><span>READY-MADE PRACTICE</span><h2>Previous Live Tests</h2><p>Completed live tests are available here to practise again.</p></div><span className="mm-practice-count">{completedTests.length} available</span></div>
    {error&&<div className="mm-workspace-error">{error}</div>}
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
    </article>)}</div>:<div className="mm-workspace-empty mm-completed-live-empty"><span>◷</span><h2>No completed live tests yet</h2><p>Once a scheduled live test ends, it will automatically appear here as a ready-made practice test.</p></div>}
   </div>}
   {section==="live-test"&&<div className="mm-practice-dashboard">
    <div className="mm-practice-section-heading"><div><span>TEST SCHEDULE</span><h2>Available tests</h2></div><span className="mm-practice-count">{completedTests.length} available</span></div>
    {error&&<div className="mm-workspace-error">{error}</div>}
    {completedTests.length?<div className="mm-completed-live-grid">{completedTests.map(test=>{
      const now=currentTime,starts=new Date(test.starts_at).getTime(),ends=new Date(test.ends_at).getTime();
      const isActive=starts<=now&&ends>now,isUpcoming=starts>now,isEnded=ends<=now;
      return <article className="mm-completed-live-card" key={test.id}>
       <div className="mm-live-card-top"><span className={isActive?"mm-live-status is-live":isEnded?"mm-live-status is-completed":"mm-live-status"}><i/>{isActive?"LIVE NOW":isEnded?"COMPLETED":"UPCOMING"}</span><span className="mm-live-card-mark">{Number(test.total_marks).toLocaleString("en-IN")} Marks</span></div>
       <h3>{test.title}</h3>
       {test.description&&<p className="mm-live-card-description">{test.description}</p>}
       <div className="mm-live-card-stats"><span><FileQuestion size={14}/>{test.question_count} Qs</span><span><Clock3 size={14}/>{Math.ceil(test.duration_seconds/60)} min</span></div>
       <div className={isActive?"mm-live-card-date mm-live-card-date-single is-active":"mm-live-card-date mm-live-card-date-single"}><CalendarDays size={14}/><span>{isActive?"Ends ":"Starts "}{new Date(isActive?ends:starts).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}</span>{!isEnded&&<b>{formatCountdown(isActive?ends:starts,now)}</b>}</div>
       <button type="button" disabled={(!isActive&&!isEnded)||startingTest===test.id} onClick={async()=>{
        if(isEnded){router.push("/live-test/leaderboard?"+new URLSearchParams({test:test.id}).toString());return;}
        setError("");setStartingTest(test.id);
        const db=createSupabaseBrowserClient();
        const {data,error}=await db.rpc("student_start_live_test",{p_test_id:test.id});
        setStartingTest("");
        if(error){setError(error.message);return;}
        const result=data as {test_id:string;attempt_id:string;duration_seconds:number};
        router.push("/practice/session?"+new URLSearchParams({test:result.test_id,attempt:result.attempt_id,minutes:String(Math.ceil(result.duration_seconds/60))}).toString());
       }}><span>{startingTest===test.id?"Preparing…":isEnded?"View leaderboard":"Start test"}</span></button>
      </article>;
    })}</div>:<div className="mm-workspace-empty mm-completed-live-empty"><span>◷</span><h2>No upcoming or active live tests</h2><p>Published tests for your selected examinations will appear here during their scheduled window.</p></div>}
   </div>}
   {section==="personal-notebook"&&<div className="mm-workspace-empty"><span>✎</span><h2>Your notebook is ready</h2><p>Saved notes and bookmarked questions will appear here.</p></div>}
  </section><footer className="mm-workspace-footer">© {new Date().getFullYear()} MockMaster <span>Practice. Improve. Achieve.</span></footer>
 </main>;
}
