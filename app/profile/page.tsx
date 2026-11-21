"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {UserRound,Mail,Phone,BookOpen,GraduationCap,CalendarDays,ShieldCheck,Edit3,Save,X} from "lucide-react";
import StudentWorkspaceHeader from "@/components/navigation/StudentWorkspaceHeader";
import MockMasterLoading from "@/app/components/ui/MockMasterLoading";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import "./profile.css";

type Subject={id:string;name:string};
type FormState={name:string;phone:string;subjectId:string;category:string;isPwd:boolean;goal:string;cycle:string};
const initial:FormState={name:"",phone:"",subjectId:"",category:"",isPwd:false,goal:"Both",cycle:"June 2027"};

export default function StudentProfilePage(){
 const router=useRouter();
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [editing,setEditing]=useState(false);
 const [email,setEmail]=useState("");
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [form,setForm]=useState<FormState>(initial);
 const [saved,setSaved]=useState<FormState>(initial);

 useEffect(()=>{void load();},[]);
 async function load(){
  setLoading(true);setError("");
  try{
   const db=createSupabaseBrowserClient();
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user){router.replace("/login");return;}
   const meta=user.user_metadata||{};
   setEmail(user.email||"");
   const {data:exam,error:examError}=await db.from("exams").select("id").eq("code","UGC_NET").maybeSingle();
   if(examError)throw examError;
   const {data:pref,error:prefError}=await db.from("student_exam_preferences").select("selected_subject_id,category,is_pwd,qualification_goal,target_exam_cycle").eq("student_id",user.id).eq("exam_id",exam?.id||"").maybeSingle();
   if(prefError)throw prefError;
   const {data:paper}=exam?await db.from("papers").select("id").eq("exam_id",exam.id).eq("code","PAPER_2").maybeSingle():{data:null};
   const {data:subjectRows}=paper?await db.from("subjects").select("id,name").eq("paper_id",paper.id).eq("is_active",true).order("display_order"):{data:[]};
   setSubjects(subjectRows||[]);
   const next:FormState={name:meta.full_name||"",phone:meta.phone_number||"",subjectId:pref?.selected_subject_id||"",category:pref?.category||"",isPwd:Boolean(pref?.is_pwd),goal:pref?.qualification_goal||"Both",cycle:pref?.target_exam_cycle||"June 2027"};
   setForm(next);setSaved(next);
  }catch(e:any){setError(e?.message||"Profile could not be loaded.");}
  finally{setLoading(false);}
 }
 async function save(){
  setSaving(true);setError("");setSuccess("");
  try{
   const db=createSupabaseBrowserClient();
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user)throw authError||new Error("Please log in again.");
   const {data:exam,error:examError}=await db.from("exams").select("id").eq("code","UGC_NET").maybeSingle();
   if(examError||!exam)throw examError||new Error("UGC NET setup not found.");
   const {error:prefError}=await db.from("student_exam_preferences").upsert({student_id:user.id,exam_id:exam.id,selected_subject_id:form.subjectId||null,category:form.category||null,is_pwd:form.isPwd,qualification_goal:form.goal||null,target_exam_cycle:form.cycle||null},{onConflict:"student_id,exam_id"});
   if(prefError)throw prefError;
   const {error:updateError}=await db.auth.updateUser({data:{full_name:form.name.trim(),phone_number:form.phone.trim(),paper2_subject_id:form.subjectId,category:form.category,is_pwd:form.isPwd,qualification_goal:form.goal,target_attempt:form.cycle}});
   if(updateError)throw updateError;
   setSaved(form);setEditing(false);setSuccess("Profile updated successfully.");
  }catch(e:any){setError(e?.message||"Profile could not be saved.");}
  finally{setSaving(false);}
 }
 if(loading)return <MockMasterLoading variant="workspace" title="Loading your profile" message="Fetching your account and exam details."/>;
 const field=(label:string,value:React.ReactNode,icon:React.ReactNode)=><div className="mm-profile-field"><span>{icon}</span><div><small>{label}</small><strong>{value||"Not provided"}</strong></div></div>;
 return <div className="mm-profile-page">
  <StudentWorkspaceHeader name={saved.name||"Student"} showNav/>
  <main className="mm-profile-content">
   <div className="mm-profile-heading"><div><span className="mm-profile-eyebrow">ACCOUNT SETTINGS</span><h1>My Profile</h1><p>View and manage your personal and UGC-NET exam details.</p></div><button type="button" onClick={()=>{setEditing(v=>!v);setError("");setSuccess("");}}>{editing?<><X size={16}/>Cancel</>:<><Edit3 size={16}/>Edit profile</>}</button></div>
   {error&&<div className="mm-profile-alert error">{error}</div>}{success&&<div className="mm-profile-alert success">{success}</div>}
   <section className="mm-profile-card">
    <div className="mm-profile-identity"><span className="mm-profile-avatar"><UserRound size={27}/></span><div><h2>{saved.name||"Student"}</h2><p>{email}</p></div></div>
    {editing?<div className="mm-profile-form">
      <label>Full name<input value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label>
      <label>Mobile number<input value={form.phone} inputMode="tel" onChange={e=>setForm(v=>({...v,phone:e.target.value}))}/></label>
      <label>Paper 2 subject<select value={form.subjectId} onChange={e=>setForm(v=>({...v,subjectId:e.target.value}))}><option value="">Select subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Category<select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}><option value="">Select category</option>{["General","EWS","OBC-NCL","SC","ST"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>PwBD<select value={form.isPwd?"yes":"no"} onChange={e=>setForm(v=>({...v,isPwd:e.target.value==="yes"}))}><option value="no">No</option><option value="yes">Yes</option></select></label>
      <label>Qualification goal<select value={form.goal} onChange={e=>setForm(v=>({...v,goal:e.target.value}))}>{["Assistant Professor","JRF","Both"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Target exam cycle<select value={form.cycle} onChange={e=>setForm(v=>({...v,cycle:e.target.value}))}>{["December 2026","June 2027","December 2027","June 2028"].map(x=><option key={x}>{x}</option>)}</select></label>
      <div className="mm-profile-form-actions"><button type="button" onClick={()=>{setForm(saved);setEditing(false);}}>Cancel</button><button type="button" disabled={saving||!form.name.trim()} onClick={()=>void save()}><Save size={16}/>{saving?"Saving…":"Save changes"}</button></div>
    </div>:<div className="mm-profile-grid">
      {field("Full name",saved.name,<UserRound size={18}/>)}{field("Email address",email,<Mail size={18}/>)}{field("Mobile number",saved.phone,<Phone size={18}/>)}{field("Paper 2 subject",subjects.find(s=>s.id===saved.subjectId)?.name,<BookOpen size={18}/>)}{field("Category",saved.category,<ShieldCheck size={18}/>)}{field("PwBD",saved.isPwd?"Yes":"No",<ShieldCheck size={18}/>)}{field("Qualification goal",saved.goal,<GraduationCap size={18}/>)}{field("Target exam cycle",saved.cycle,<CalendarDays size={18}/>)}
    </div>}
   </section>
  </main>
 </div>;
}
