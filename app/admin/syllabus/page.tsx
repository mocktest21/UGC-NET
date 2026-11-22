"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import MockMasterLoading from "@/app/components/ui/MockMasterLoading";
import "./syllabus.css";

type Level="exams"|"papers"|"subjects"|"units"|"topics";
type Row={id:string;code?:string|null;name:string;description?:string|null;is_active:boolean;display_order:number;exam_id?:string;paper_id?:string;subject_id?:string;unit_id?:string;unit_number?:number|null;is_compulsory?:boolean};
type QRef={unit_id:string|null;topic_id:string|null};
const LEVELS:{key:Level;label:string;singular:string}[]=[{key:"exams",label:"Examinations",singular:"Examination"},{key:"papers",label:"Papers",singular:"Paper"},{key:"subjects",label:"Subjects",singular:"Subject"},{key:"units",label:"Units",singular:"Unit"},{key:"topics",label:"Topics",singular:"Topic"}];
const EMPTY={name:"",code:"",description:"",display_order:"0",unit_number:"1",is_compulsory:false};

export default function AdminSyllabusPage(){
 const router=useRouter();
 const [supabase]=useState(()=>createSupabaseBrowserClient());
 const [checking,setChecking]=useState(true),[admin,setAdmin]=useState(false);
 const [level,setLevel]=useState<Level>("exams");
 const [rows,setRows]=useState<Record<Level,Row[]>>({exams:[],papers:[],subjects:[],units:[],topics:[]});
 const [counts,setCounts]=useState<QRef[]>([]);
 const [exam,setExam]=useState(""),[paper,setPaper]=useState(""),[subject,setSubject]=useState(""),[unit,setUnit]=useState("");
 const [form,setForm]=useState(EMPTY),[editing,setEditing]=useState<string|null>(null),[showForm,setShowForm]=useState(false);
 const [includeInactive,setIncludeInactive]=useState(false),[search,setSearch]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");

 const load=useCallback(async()=>{
  const keys:Level[]=["exams","papers","subjects","units","topics"];
  const res=await Promise.all(keys.map(k=>supabase.from(k).select("*").order("display_order").order("name")));
  const next={} as Record<Level,Row[]>;
  keys.forEach((k,i)=>{if(res[i].error)throw res[i].error;next[k]=(res[i].data||[]) as Row[];});
  setRows(next);
  const {data,error:e}=await supabase.from("questions").select("unit_id,topic_id");
  if(e)throw e;setCounts((data||[]) as QRef[]);
  setExam(v=>v||next.exams[0]?.id||"");setPaper(v=>v||next.papers[0]?.id||"");
  setSubject(v=>v||next.subjects[0]?.id||"");setUnit(v=>v||next.units[0]?.id||"");
 },[supabase]);

 useEffect(()=>{let alive=true;(async()=>{
  const {data,error:e}=await supabase.auth.getUser();if(!alive)return;
  if(e||!data.user){router.replace("/admin/login");return;}
  if(data.user.app_metadata?.role!=="admin"){setChecking(false);return;}
  setAdmin(true);try{await load();}catch(err:any){setError(err?.message||"Could not load syllabus data.");}
  if(alive)setChecking(false);
 })();return()=>{alive=false;};},[router,supabase,load]);

 const filtered=useMemo(()=>rows[level].filter(r=>{
  if(!includeInactive&&!r.is_active)return false;
  const q=search.trim().toLowerCase();if(q&&!r.name.toLowerCase().includes(q)&&!(r.code||"").toLowerCase().includes(q))return false;
  if(level==="papers"&&r.exam_id!==exam)return false;
  if(level==="subjects"&&r.paper_id!==paper)return false;
  if(level==="units"&&r.subject_id!==subject)return false;
  if(level==="topics"&&r.unit_id!==unit)return false;return true;
 }),[rows,level,includeInactive,search,exam,paper,subject,unit]);
 const active=rows[level].filter(r=>r.is_active).length;
 function canAdd(){return level==="exams"||(level==="papers"&&!!exam)||(level==="subjects"&&!!paper)||(level==="units"&&!!subject)||(level==="topics"&&!!unit);}
 function openCreate(){setEditing(null);setForm({...EMPTY,display_order:String(rows[level].length)});setShowForm(true);setError("");setMessage("");}
 function openEdit(r:Row){setEditing(r.id);setForm({name:r.name,code:r.code||"",description:r.description||"",display_order:String(r.display_order||0),unit_number:String(r.unit_number||1),is_compulsory:!!r.is_compulsory});setShowForm(true);setError("");setMessage("");}
 function parentData(){
  if(level==="papers")return {exam_id:exam};
  if(level==="subjects")return {exam_id:exam,paper_id:paper};
  if(level==="units")return {subject_id:subject};
  if(level==="topics")return {unit_id:unit};return {};
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");setMessage("");
  if(!form.name.trim()){setError("Name is required.");return;}
  if(!canAdd()){setError("Select the parent level first.");return;}
  const payload:any={...parentData(),name:form.name.trim(),description:form.description.trim()||null,display_order:Number(form.display_order)||0};
  if(level!=="topics")payload.code=form.code.trim()||null;
  if(level==="units")payload.unit_number=Number(form.unit_number)||null;
  if(level==="papers")payload.is_compulsory=form.is_compulsory;
  setBusy(true);
  const result=editing?await supabase.from(level).update(payload).eq("id",editing):await supabase.from(level).insert(payload);
  setBusy(false);if(result.error){setError(result.error.message);return;}
  setMessage(editing?"Record updated successfully.":"Record added successfully.");setShowForm(false);setEditing(null);
  try{await load();}catch(err:any){setError(err?.message||"Saved, but refresh failed.");}
 }
 async function toggle(r:Row){
  if(r.is_active&&!window.confirm('Deactivate "'+r.name+'"? Existing question links and student history will be retained.'))return;
  setBusy(true);setError("");setMessage("");
  const {error:e}=await supabase.from(level).update({is_active:!r.is_active}).eq("id",r.id);
  setBusy(false);if(e){setError(e.message);return;}
  setMessage(r.name+(r.is_active?" deactivated.":" activated."));
  try{await load();}catch(err:any){setError(err?.message||"Refresh failed.");}
 }
 function mapped(r:Row){return level==="units"?counts.filter(x=>x.unit_id===r.id).length:counts.filter(x=>x.topic_id===r.id).length;}
 if(checking)return <MockMasterLoading variant="admin" title="Loading syllabus manager"/>;
 if(!admin)return <main className="sy-state"><section><h1>Administrator access required</h1><p>This module is restricted to authorised administrators.</p><button onClick={()=>router.replace("/admin/login")}>Go to admin login</button></section></main>;
 return <main className="sy-shell">
  <header className="sy-header"><div><a href="/admin">← Admin workspace</a><span>CONTENT MANAGEMENT</span><h1>Syllabus Manager</h1><p>Manage the exam hierarchy used by Question Bank and student practice.</p></div><button className="sy-primary" onClick={openCreate}>＋ Add {LEVELS.find(x=>x.key===level)!.singular}</button></header>
  <section className="sy-summary"><article><small>Total {LEVELS.find(x=>x.key===level)!.label}</small><b>{rows[level].length}</b></article><article><small>Active</small><b>{active}</b></article><article><small>Inactive</small><b>{rows[level].length-active}</b></article><article><small>Questions mapped</small><b>{level==="units"?counts.filter(x=>x.unit_id).length:level==="topics"?counts.filter(x=>x.topic_id).length:"—"}</b></article></section>
  <section className="sy-workspace">
   <nav className="sy-levels">{LEVELS.map((x,i)=><button key={x.key} className={level===x.key?"active":""} onClick={()=>{setLevel(x.key);setShowForm(false);setSearch("");setMessage("");setError("");}}><span>{String(i+1).padStart(2,"0")}</span>{x.label}<small>{rows[x.key].filter(r=>r.is_active).length}</small></button>)}</nav>
   <div className="sy-content">
    <div className="sy-toolbar"><div><h2>{LEVELS.find(x=>x.key===level)!.label}</h2><p>Choose a record to edit or change its active status.</p></div><label className="sy-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or code"/></label></div>
    {level!=="exams"&&<div className="sy-parent-filters">
     {level!=="papers"&&<label>Examination<select value={exam} onChange={e=>{setExam(e.target.value);setPaper("");setSubject("");setUnit("");}}><option value="">Select examination</option>{rows.exams.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
     {["subjects","units","topics"].includes(level)&&<label>Paper<select value={paper} onChange={e=>{setPaper(e.target.value);setSubject("");setUnit("");}}><option value="">Select paper</option>{rows.papers.filter(x=>x.exam_id===exam).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
     {["units","topics"].includes(level)&&<label>Subject<select value={subject} onChange={e=>{setSubject(e.target.value);setUnit("");}}><option value="">Select subject</option>{rows.subjects.filter(x=>x.paper_id===paper).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
     {level==="topics"&&<label>Unit<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="">Select unit</option>{rows.units.filter(x=>x.subject_id===subject).map(x=><option key={x.id} value={x.id}>{x.unit_number?"Unit "+x.unit_number+" · ":""}{x.name}</option>)}</select></label>}
    </div>}
    <div className="sy-list-tools"><label><input type="checkbox" checked={includeInactive} onChange={e=>setIncludeInactive(e.target.checked)}/> Show inactive</label><span>{filtered.length} records</span></div>
    {message&&<div className="sy-message">{message}</div>}{error&&<div className="sy-error">{error}</div>}
    {showForm&&<form className="sy-form" onSubmit={save}>
     <div className="sy-form-head"><div><b>{editing?"Edit":"Add"} {LEVELS.find(x=>x.key===level)!.singular}</b><small>Saved to the existing syllabus tables.</small></div><button type="button" onClick={()=>setShowForm(false)}>×</button></div>
     <div className="sy-parent-note">{level==="exams"?"Top-level examination":level==="papers"?"Parent: "+(rows.exams.find(x=>x.id===exam)?.name||"Select examination"):level==="subjects"?"Parent: "+(rows.papers.find(x=>x.id===paper)?.name||"Select paper"):level==="units"?"Parent: "+(rows.subjects.find(x=>x.id===subject)?.name||"Select subject"):"Parent: "+(rows.units.find(x=>x.id===unit)?.name||"Select unit")}</div>
     <div className="sy-fields">
      <label className="wide">Name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Enter name"/></label>
      {level!=="topics"&&<label>Code<input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="Optional code"/></label>}
      {level==="units"&&<label>Unit number<input type="number" min="1" value={form.unit_number} onChange={e=>setForm({...form,unit_number:e.target.value})}/></label>}
      {level==="papers"&&<label className="sy-check"><input type="checkbox" checked={form.is_compulsory} onChange={e=>setForm({...form,is_compulsory:e.target.checked})}/> Compulsory paper</label>}
      <label>Display order<input type="number" value={form.display_order} onChange={e=>setForm({...form,display_order:e.target.value})}/></label>
      <label className="wide">Description<textarea rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Optional description"/></label>
     </div>
     <div className="sy-form-actions"><button type="button" className="sy-secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="sy-primary" disabled={busy||!canAdd()}>{busy?"Saving…":editing?"Save changes":"Add to syllabus"}</button></div>
    </form>}
    <div className="sy-records">{filtered.length===0?<div className="sy-empty"><span>☷</span><b>No {LEVELS.find(x=>x.key===level)!.label.toLowerCase()} found</b><p>{canAdd()?"Add a new item or change the filters.":"Select the parent levels first."}</p><button onClick={openCreate} disabled={!canAdd()}>＋ Add first item</button></div>:filtered.map((r,i)=><article className={!r.is_active?"inactive":""} key={r.id}>
     <span className="sy-index">{level==="units"&&r.unit_number?"U"+r.unit_number:String(i+1).padStart(2,"0")}</span><div className="sy-record-main"><b>{r.name}</b><small>{r.code||r.description||"No code or description"}</small></div>
     {(level==="units"||level==="topics")&&<span className="sy-question-count">{mapped(r)} questions</span>}<span className={r.is_active?"sy-status":"sy-status off"}>{r.is_active?"Active":"Inactive"}</span>
     <button className="sy-edit" onClick={()=>openEdit(r)}>Edit</button><button className="sy-toggle" disabled={busy} onClick={()=>void toggle(r)}>{r.is_active?"Deactivate":"Activate"}</button>
    </article>)}</div>
    <p className="sy-footnote">Deactivation is reversible. Records are not permanently deleted, so existing question links and student history remain intact.</p>
   </div>
  </section>
 </main>;
}
