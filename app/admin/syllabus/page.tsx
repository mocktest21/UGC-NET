"use client";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import MockMasterLoading from "@/app/components/ui/MockMasterLoading";
import "./syllabus.css";

type Level="exams"|"papers"|"subjects"|"units"|"topics";
type Row={id:string;code?:string|null;name:string;description?:string|null;is_active:boolean;display_order:number;exam_id?:string;paper_id?:string;subject_id?:string;unit_id?:string;unit_number?:number|null;is_compulsory?:boolean};
type QRef={unit_id:string|null;topic_id:string|null};
type ImportRow={exam_code:string;exam_name:string;paper_code:string;paper_name:string;subject_code:string;subject_name:string;unit_number:string;unit_code:string;unit_name:string;topic_name:string;description:string;display_order:string;row:number;error?:string};
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
 const [showImport,setShowImport]=useState(false),[importRows,setImportRows]=useState<ImportRow[]>([]),[importFile,setImportFile]=useState(""),[importing,setImporting]=useState(false),[importSummary,setImportSummary]=useState("");

 const load=useCallback(async()=>{
  const keys:Level[]=["exams","papers","subjects","units","topics"];
  const res=await Promise.all(keys.map(k=>supabase.from(k).select("*").order("display_order").order("name")));
  const next={} as Record<Level,Row[]>;
  keys.forEach((k,i)=>{if(res[i].error)throw res[i].error;next[k]=(res[i].data||[]) as Row[];});
  setRows(next);
  const allRefs:QRef[]=[];
  for(let offset=0;;offset+=1000){
   const {data,error:e}=await supabase.from("questions").select("unit_id,topic_id").range(offset,offset+999);
   if(e)throw e;allRefs.push(...((data||[]) as QRef[]));if(!data||data.length<1000)break;
  }
  setCounts(allRefs);
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
  const result=editing?await supabase.from(level as any).update(payload).eq("id",editing):await supabase.from(level as any).insert(payload);
  setBusy(false);if(result.error){setError(result.error.message);return;}
  setMessage(editing?"Record updated successfully.":"Record added successfully.");setShowForm(false);setEditing(null);
  try{await load();}catch(err:any){setError(err?.message||"Saved, but refresh failed.");}
 }
 async function toggle(r:Row){
  if(r.is_active&&!window.confirm('Deactivate "'+r.name+'"? Existing question links and student history will be retained.'))return;
  setBusy(true);setError("");setMessage("");
  const {error:e}=await supabase.from(level as any).update({is_active:!r.is_active}).eq("id",r.id);
  setBusy(false);if(e){setError(e.message);return;}
  setMessage(r.name+(r.is_active?" deactivated.":" activated."));
  try{await load();}catch(err:any){setError(err?.message||"Refresh failed.");}
 }

 function downloadTemplate(){
  const headers=["exam_code","exam_name","paper_code","paper_name","subject_code","subject_name","unit_number","unit_code","unit_name","topic_name","description","display_order"];
  const example=["UGC_NET","UGC-NET","PAPER_2","Paper 2","08","Commerce","1","COM_U1","Business Environment and International Business","Concept, Nature and Scope","","1"];
  const ws=XLSX.utils.aoa_to_sheet([headers,example]);
  ws["!cols"]=headers.map(h=>({wch:Math.max(15,h.length+3)}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Syllabus");
  XLSX.writeFile(wb,"MockMaster_Syllabus_Import_Template.xlsx");
 }
 async function parseImportFile(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file)return;
  setError("");setMessage("");setImportSummary("");setImportFile(file.name);setImportRows([]);
  try{
   const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});
   const first=wb.SheetNames[0];if(!first)throw new Error("Excel file has no worksheet.");
   const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[first],{defval:""});
   if(!raw.length)throw new Error("The worksheet is empty.");
   const required=["exam_code","exam_name","paper_code","paper_name","subject_name","unit_number","unit_name"];
   const headers=Object.keys(raw[0]).map(x=>x.trim().toLowerCase());
   const missing=required.filter(x=>!headers.includes(x));
   if(missing.length)throw new Error("Missing required columns: "+missing.join(", "));
   const parsed:ImportRow[]=raw.map((r,i)=>{
    const val=(key:string)=>String(r[Object.keys(r).find(k=>k.trim().toLowerCase()===key)]??"").trim();
    return {exam_code:val("exam_code"),exam_name:val("exam_name"),paper_code:val("paper_code"),paper_name:val("paper_name"),subject_code:val("subject_code"),subject_name:val("subject_name"),unit_number:val("unit_number"),unit_code:val("unit_code"),unit_name:val("unit_name"),topic_name:val("topic_name"),description:val("description"),display_order:val("display_order"),row:i+2};
   });
   const seen=new Set<string>();
   parsed.forEach(r=>{
    const requiredValues=[r.exam_code,r.exam_name,r.paper_code,r.paper_name,r.subject_name,r.unit_number,r.unit_name];
    if(requiredValues.some(x=>!x))r.error="Required hierarchy field is blank.";
    else if(!/^[1-9]\d*$/.test(r.unit_number))r.error="Unit number must be a positive integer.";
    else{
     const key=[r.exam_code,r.paper_code,r.subject_name,r.unit_number,r.unit_name,r.topic_name].map(x=>x.toLowerCase()).join("|");
     if(seen.has(key))r.error="Duplicate hierarchy row in this Excel file.";else seen.add(key);
    }
   });
   setImportRows(parsed);
  }catch(err:any){setError(err?.message||"Could not read this Excel file.");}
  e.target.value="";
 }
 async function importSyllabus(){
  if(!importRows.length||importRows.some(r=>r.error)||importing)return;
  if(!window.confirm("Import "+importRows.length+" syllabus row(s)? Existing matching records will be reused; only missing hierarchy records will be added. No existing syllabus record or student progress will be deleted."))return;
  setImporting(true);setError("");setImportSummary("");
  let added={exams:0,papers:0,subjects:0,units:0,topics:0},reused={exams:0,papers:0,subjects:0,units:0,topics:0};
  const failed:{row:number;message:string}[]=[];
  const cache={
   exams:[...rows.exams],papers:[...rows.papers],subjects:[...rows.subjects],units:[...rows.units],topics:[...rows.topics]
  } as Record<Level,Row[]>;
  async function findOrCreate(table:Level,match:(x:Row)=>boolean,payload:Record<string,unknown>):Promise<Row>{
   const found=cache[table].find(match);if(found){reused[table]++;return found;}
   const {data,error:e}=await supabase.from(table).insert(payload).select("*").single();
   if(e)throw e;
   const created=data as Row;cache[table].push(created);added[table]++;return created;
  }
  for(const r of importRows){
   try{
    const ex=await findOrCreate("exams",x=>x.code?.toLowerCase()===r.exam_code.toLowerCase(),{code:r.exam_code,name:r.exam_name,description:null,is_active:true,display_order:0});
    const pa=await findOrCreate("papers",x=>x.exam_id===ex.id&&(x.code?.toLowerCase()===r.paper_code.toLowerCase()||x.name.toLowerCase()===r.paper_name.toLowerCase()),{exam_id:ex.id,code:r.paper_code,name:r.paper_name,description:null,is_compulsory:r.paper_code.toUpperCase()==="PAPER_1",is_active:true,display_order:0});
    const su=await findOrCreate("subjects",x=>x.paper_id===pa.id&&((r.subject_code&&x.code?.toLowerCase()===r.subject_code.toLowerCase())||x.name.toLowerCase()===r.subject_name.toLowerCase()),{exam_id:ex.id,paper_id:pa.id,code:r.subject_code||null,name:r.subject_name,description:null,is_active:true,display_order:0});
    const un=await findOrCreate("units",x=>x.subject_id===su.id&&(x.unit_number===Number(r.unit_number)||x.name.toLowerCase()===r.unit_name.toLowerCase()),{subject_id:su.id,unit_number:Number(r.unit_number),code:r.unit_code||null,name:r.unit_name,description:r.description||null,is_active:true,display_order:Number(r.display_order)||Number(r.unit_number)});
    if(r.topic_name.trim())await findOrCreate("topics",x=>x.unit_id===un.id&&x.name.toLowerCase()===r.topic_name.toLowerCase(),{unit_id:un.id,name:r.topic_name,description:null,is_active:true,display_order:Number(r.display_order)||0});
   }catch(err:any){failed.push({row:r.row,message:err?.message||"Import failed"});}
  }
  setImporting(false);
  setImportSummary("Added — Exams: "+added.exams+", Papers: "+added.papers+", Subjects: "+added.subjects+", Units: "+added.units+", Topics: "+added.topics+". Reused existing: "+Object.values(reused).reduce((a,b)=>a+b,0)+". Failed rows: "+failed.length+(failed.length?" (Excel rows "+failed.slice(0,8).map(x=>x.row).join(", ")+")":""));
  if(failed.length)setError(failed.slice(0,8).map(x=>"Row "+x.row+": "+x.message).join(" | "));
  else setMessage("Syllabus Excel import completed successfully.");
  await load();
 }

 function mapped(r:Row){return level==="units"?counts.filter(x=>x.unit_id===r.id).length:counts.filter(x=>x.topic_id===r.id).length;}
 if(checking)return <MockMasterLoading variant="admin" title="Loading syllabus manager"/>;
 if(!admin)return <main className="sy-state"><section><h1>Administrator access required</h1><p>This module is restricted to authorised administrators.</p><button onClick={()=>router.replace("/admin/login")}>Go to admin login</button></section></main>;
 return <main className="sy-shell">
  <header className="sy-header"><div><a href="/admin">← Admin workspace</a><span>CONTENT MANAGEMENT</span><h1>Syllabus Manager</h1><p>Manage the exam hierarchy used by Question Bank and student practice.</p></div><div className="sy-header-actions"><button className="sy-secondary" onClick={()=>{setShowImport(v=>!v);setShowForm(false);}}>⇧ Excel Import</button><button className="sy-primary" onClick={openCreate}>＋ Add {LEVELS.find(x=>x.key===level)!.singular}</button></div></header>
  {showImport&&<section className="sy-import"><div className="sy-import-head"><div><span>EXCEL BULK UPLOAD</span><h2>Import complete syllabus hierarchy</h2><p>One row per topic. Parent records are matched within their selected parent; existing records are reused, missing records are created.</p></div><button onClick={()=>setShowImport(false)}>×</button></div><div className="sy-import-format"><b>Required columns</b><code>exam_code, exam_name, paper_code, paper_name, subject_name, unit_number, unit_name</code><b>Optional columns</b><code>subject_code, unit_code, topic_name, description, display_order</code><small>Example: UGC_NET → PAPER_2 → Commerce → Unit 1 → Business Environment and International Business → Topic name</small></div><div className="sy-import-actions"><button className="sy-secondary" onClick={downloadTemplate}>↓ Download Excel template</button><label className="sy-file">Choose Excel file<input type="file" accept=".xlsx,.xls" onChange={parseImportFile}/></label></div>{importFile&&<p className="sy-file-name">Selected: {importFile}</p>}{importRows.length>0&&<><div className="sy-preview-head"><b>Import preview</b><span>{importRows.length} rows · {importRows.filter(r=>r.error).length} errors</span></div><div className="sy-preview-wrap"><table className="sy-preview"><thead><tr><th>Row</th><th>Exam</th><th>Paper</th><th>Subject</th><th>Unit</th><th>Topic</th><th>Validation</th></tr></thead><tbody>{importRows.slice(0,100).map(r=><tr key={r.row}><td>{r.row}</td><td>{r.exam_name}</td><td>{r.paper_name}</td><td>{r.subject_name}</td><td>{r.unit_number}: {r.unit_name}</td><td>{r.topic_name||"—"}</td><td className={r.error?"bad":"good"}>{r.error||"Ready"}</td></tr>)}</tbody></table></div>{importRows.length>100&&<small>Showing first 100 rows in preview. All {importRows.length} rows will be processed.</small>}<button className="sy-primary" disabled={importing||importRows.some(r=>r.error)} onClick={()=>void importSyllabus()}>{importing?"Importing…":"Import "+importRows.length+" rows"}</button></>}{importSummary&&<div className="sy-message">{importSummary}</div>}</section>}
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
