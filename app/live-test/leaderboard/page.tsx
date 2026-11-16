"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,Trophy,Medal,RefreshCw} from "lucide-react";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";

type Row={leaderboard_rank:number;student_id:string;student_name:string;score:number;max_score:number};
export default function LiveTestLeaderboardPage(){
 const router=useRouter();
 const [testId,setTestId]=useState("");
 useEffect(()=>{setTestId(new URLSearchParams(window.location.search).get("test")||"");},[]);
 const [db]=useState(()=>createSupabaseBrowserClient());
 const [rows,setRows]=useState<Row[]>([]),[title,setTitle]=useState("Live test leaderboard"),[studentId,setStudentId]=useState("");
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;void(async()=>{
  const {data:auth}=await db.auth.getUser();
  if(!auth.user){router.replace("/login");return;}
  if(active)setStudentId(auth.user.id);
  if(!testId){if(active){setError("Test reference is missing.");setLoading(false);}return;}
  const {data:test,error:testError}=await db.from("tests").select("title").eq("id",testId).maybeSingle();
  if(testError){if(active){setError(testError.message);setLoading(false);}return;}
  if(test?.title&&active)setTitle(test.title);
  const {data,error:boardError}=await db.rpc("student_get_live_test_leaderboard",{p_test_id:testId});
  if(active){if(boardError)setError(boardError.message);else setRows((data||[]) as Row[]);setLoading(false);}
 })().catch(e=>{if(active){setError(e instanceof Error?e.message:"Unable to load leaderboard.");setLoading(false);}});
 return()=>{active=false;};},[db,router,testId]);
 const mine=rows.find(row=>row.student_id===studentId);
 return <main className="mm-workspace-page mm-leaderboard-page">
  <header className="mm-workspace-header"><a className="mm-brand" href="/"><span className="mm-brand-mark">M</span><span>MockMaster</span></a></header>
  <section className="mm-workspace-content">
   <button className="mm-leaderboard-back" onClick={()=>router.push("/live-test")}><ArrowLeft size={16}/> Back to Live Tests</button>
   <div className="mm-leaderboard-heading"><span>MOCKMASTER · RESULTS</span><h1>Leaderboard</h1><p>{title}</p></div>
   {mine&&<div className="mm-leaderboard-you"><Trophy size={18}/><div><b>Your position</b><span>Rank #{mine.leaderboard_rank} · {Number(mine.score).toLocaleString("en-IN")} marks</span></div></div>}
   {error&&<div className="mm-workspace-error">{error}</div>}
   {loading?<div className="mm-workspace-empty">Loading leaderboard…</div>:!error?<div className="mm-leaderboard-card">
    <div className="mm-leaderboard-card-head"><div><span>FINAL STANDINGS</span><h2>Student rankings</h2></div><span>{rows.length} students</span></div>
    {rows.length?<div className="mm-leaderboard-table-wrap"><table className="mm-leaderboard-table"><thead><tr><th>Rank</th><th>Student</th><th>Score</th></tr></thead><tbody>{rows.map(row=><tr key={row.student_id} className={row.student_id===studentId?"is-me":""}><td><span className="mm-leaderboard-rank">{row.leaderboard_rank===1?<Medal size={16}/>:null}{row.leaderboard_rank}</span></td><td>{row.student_name}{row.student_id===studentId&&<span className="mm-leaderboard-you-tag">YOU</span>}</td><td><b>{Number(row.score).toLocaleString("en-IN")}</b><small> / {Number(row.max_score).toLocaleString("en-IN")}</small></td></tr>)}</tbody></table></div>:<div className="mm-workspace-empty"><h2>No results published yet</h2><p>Completed student scores will appear here once they are submitted and graded.</p></div>}
    {!mine&&rows.length>0&&<p className="mm-leaderboard-note">Your name will be highlighted here after you submit this live test.</p>}
   </div>:null}
  </section>
 </main>;
}
