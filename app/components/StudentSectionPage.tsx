"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";

type Section="practice"|"live-test"|"personal-notebook";
type Course={id:string;examId:string;paperId:string;subjectId:string|null;title:string;subtitle:string;paperName:string;subjectName:string|null;count:number;kind:"paper"|"subject"};
const links=[{label:"Dashboard",href:"/dashboard"},{label:"Practice",href:"/practice"},{label:"Live Test",href:"/live-test"},{label:"Personal Notebook",href:"/personal-notebook"},{label:"About Us",href:"/About"}];
const content={practice:{title:"Practice centre",subtitle:"Your selected papers and subjects, ready for focused practice."},"live-test":{title:"Live tests",subtitle:"Find your scheduled mock tests and attempt them within the test window."},"personal-notebook":{title:"Personal notebook",subtitle:"Keep your important learning points and revision notes in one place."}};
export default function StudentSectionPage({section}:{section:Section}){
 const router=useRouter();
 const [name,setName]=useState("Student"),[loading,setLoading]=useState(true),[courses,setCourses]=useState<Course[]>([]),[error,setError]=useState("");
 useEffect(()=>{let active=true;void(async()=>{
  const db=createSupabaseBrowserClient();
  const {data:auth,error:authError}=await db.auth.getUser();
  if(authError||!auth.user){router.replace("/login");return;}
  const fullName=(auth.user.user_metadata?.full_name as string)||"Student";
  if(active)setName(fullName.trim().split(/\s+/)[0]||"Student");
  if(section==="practice"){
   const {data:exam}=await db.from("exams").select("id,name").eq("code","UGC_NET").eq("is_active",true).maybeSingle();
   if(exam){
    const {data:prefs,error:prefError}=await db.from("student_exam_preferences").select("selected_subject_id").eq("student_id",auth.user.id).eq("exam_id",exam.id).maybeSingle();
    if(prefError&&active)setError(prefError.message);
    const {data:papers}=await db.from("papers").select("id,name,code").eq("exam_id",exam.id).eq("is_active",true).order("display_order");
    const paperRows=papers||[];
    const paper1=paperRows.find((p:any)=>/paper\s*1|common/i.test(p.name+" "+p.code));
    const cards:Course[]=[];
    if(paper1){
     const {count}=await db.from("questions").select("id",{count:"exact",head:true}).eq("exam_id",exam.id).eq("paper_id",paper1.id).eq("status","approved");
     cards.push({id:paper1.id,examId:exam.id,paperId:paper1.id,subjectId:null,title:paper1.name,subtitle:"Teaching and Research Aptitude",paperName:paper1.name,subjectName:null,count:count||0,kind:"paper"});
    }
    const selectedSubjectId=prefs?.selected_subject_id;
    if(selectedSubjectId){
     const {data:subject}=await db.from("subjects").select("id,name,paper_id,papers(name)").eq("id",selectedSubjectId).eq("is_active",true).maybeSingle();
     if(subject){
      const {count}=await db.from("questions").select("id",{count:"exact",head:true}).eq("exam_id",exam.id).eq("paper_id",subject.paper_id).eq("subject_id",subject.id).eq("status","approved");
      const paperName=Array.isArray(subject.papers)?(subject.papers[0] as any)?.name:(subject.papers as any)?.name;
      cards.push({id:subject.id,examId:exam.id,paperId:subject.paper_id,subjectId:subject.id,title:subject.name,subtitle:"Paper 2 · Subject-wise and unit-wise practice",paperName:paperName||"Paper 2",subjectName:subject.name,count:count||0,kind:"subject"});
     }
    }
    if(active)setCourses(cards);
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
   {section==="practice"&&<div className="mm-practice-dashboard"><div className="mm-practice-section-heading"><div><span>YOUR LEARNING PATH</span><h2>Selected papers & subjects</h2><p>Only the papers and subjects in your profile are shown here.</p></div><span className="mm-practice-count">{courses.length} selected</span></div>
    {error&&<div className="mm-workspace-error">{error}</div>}
    {courses.length?<div className="mm-workspace-cards">{courses.map(course=><article className="mm-practice-course-card" key={course.id}><div className="mm-course-top"><span className="mm-course-icon">{course.kind==="paper"?"▤":"◈"}</span><span className="mm-course-tag">{course.kind==="paper"?"COMMON PAPER":"YOUR SELECTED SUBJECT"}</span></div><small>{course.paperName}</small><h2>{course.title}</h2><p>{course.subtitle}</p><div className="mm-course-bank"><strong>{course.count.toLocaleString("en-IN")}</strong><span>approved questions available</span></div><a href={course.kind==="paper"?"/practice/build-test":"/practice/build-test"} onClick={()=>{sessionStorage.setItem("mm-practice-paper",course.paperId);if(course.subjectId)sessionStorage.setItem("mm-practice-subject",course.subjectId);else sessionStorage.removeItem("mm-practice-subject");}}>Practise this {course.kind==="paper"?"paper":"subject"} <b>→</b></a></article>)}</div>:<div className="mm-workspace-empty"><span>◎</span><h2>No practice subjects selected</h2><p>Choose your UGC NET Paper 2 subject in your profile to see it here. Paper 1 appears automatically when it is available.</p><a href="/dashboard">Go to dashboard →</a></div>}
   </div>}
   {section==="live-test"&&<div className="mm-workspace-empty"><span>◷</span><h2>No live test is scheduled right now</h2><p>Your upcoming and active tests will be listed here.</p></div>}
   {section==="personal-notebook"&&<div className="mm-workspace-empty"><span>✎</span><h2>Your notebook is ready</h2><p>Saved notes and bookmarked questions will appear here.</p></div>}
  </section><footer className="mm-workspace-footer">© {new Date().getFullYear()} MockMaster <span>Practice. Improve. Achieve.</span></footer>
 </main>;
}
