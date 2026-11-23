"use client";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AdminNavigation from "../AdminNavigation";
import MockMasterLoading from "@/app/components/ui/MockMasterLoading";
import "./full-length.css";

type Row = Record<string, any>;
type Taxonomy = { id:string; name:string; code?:string|null };
const PAPER1_ID = "0471751a-0a43-48d7-8641-3537fd9965d2";
const PAPER2_ID = "b8b8e8e3-5b34-4338-9aef-0148de0c1c1f";
const PAPER1_SUBJECT_ID = "6d0de77f-2022-4c5e-967a-3de56b2ac84a";
const EXAM_ID = "b2a1b8c4-3a3e-4e2c-9b01-000000000001";
export default function FullLengthAdminPage(){
 const router=useRouter();
 const [db]=useState(()=>typeof window==="undefined"?null:createSupabaseBrowserClient());
 const [checking,setChecking]=useState(true),[admin,setAdmin]=useState(false);
 const [exams,setExams]=useState<Taxonomy[]>([]),[paper2Subjects,setPaper2Subjects]=useState<Taxonomy[]>([]);
 const [examId,setExamId]=useState(""),[subjectId,setSubjectId]=useState("");
 const [title,setTitle]=useState(""),[description,setDescription]=useState("");
 const [rows,setRows]=useState<Row[]>([]),[fileName,setFileName]=useState("");
 const [errors,setErrors]=useState<string[]>([]),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const [draftId,setDraftId]=useState(""),[published,setPublished]=useState(false);
 useEffect(()=>{if(!db)return;let live=true;void(async()=>{
  const {data,error}=await db.auth.getUser();if(!live)return;
  if(error||!data.user){router.replace("/admin/login");return;}
  if(data.user.app_metadata?.role!=="admin"){setChecking(false);return;}
  setAdmin(true);
  const [{data:ex},{data:sub}]=await Promise.all([
   db.from("exams").select("id,name,code").eq("is_active",true).order("display_order"),
   db.from("subjects").select("id,name,code").eq("paper_id",PAPER2_ID).eq("is_active",true).order("display_order")
  ]);
  if(live){setExams((ex||[]) as Taxonomy[]);setPaper2Subjects((sub||[]) as Taxonomy[]);if(ex?.[0])setExamId(ex[0].id);if(sub?.[0])setSubjectId(sub[0].id);setChecking(false);}
 })();return()=>{live=false;};},[db,router]);
 const counts=useMemo(()=>({p1:rows.filter(r=>r.paper_id===PAPER1_ID).length,p2:rows.filter(r=>r.paper_id===PAPER2_ID).length}),[rows]);
 function readExcel(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file)return;
  setFileName(file.name);setRows([]);setErrors([]);setDraftId("");setPublished(false);
  void(async()=>{try{
   const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});
   const sheet=wb.SheetNames.find(n=>n.trim().toLowerCase()==="final upload")||wb.SheetNames[0];
   const raw=XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheet],{defval:"",raw:false});
   const normalized=raw.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k.trim().toLowerCase(),v])));
   const problems:string[]=[];
   if(!normalized.length)problems.push("Excel sheet is empty.");
   const required=["exam_id","paper_id","subject_id","question","correct_answer","option_a","option_b","option_c","option_d"];
   const headers=Object.keys(normalized[0]||{});
   required.forEach(k=>{if(!headers.includes(k))problems.push("Missing column: "+k);});
   normalized.forEach((r,i)=>{
    const line=i+2;
    if(String(r.exam_id)!==examId)problems.push("Row "+line+": exam_id does not match selected examination.");
    if(![PAPER1_ID,PAPER2_ID].includes(String(r.paper_id)))problems.push("Row "+line+": paper_id must be Paper 1 or Paper 2.");
    if(r.paper_id===PAPER1_ID&&String(r.subject_id)!==PAPER1_SUBJECT_ID)problems.push("Row "+line+": Paper 1 subject mapping is incorrect.");
    if(r.paper_id===PAPER2_ID&&String(r.subject_id)!==subjectId)problems.push("Row "+line+": Paper 2 subject must match selected subject.");
    if(!String(r.question||"").trim())problems.push("Row "+line+": question is blank.");
    if(!String(r.correct_answer||r.answer_key_json||"").trim())problems.push("Row "+line+": correct answer is missing.");
    ["option_a","option_b","option_c","option_d"].forEach(k=>{if(!String(r[k]||"").trim())problems.push("Row "+line+": "+k+" is blank.");});
    if(r.unit_id&&!/^[0-9a-f-]{36}$/i.test(String(r.unit_id)))problems.push("Row "+line+": invalid unit_id.");
    if(r.topic_id&&!/^[0-9a-f-]{36}$/i.test(String(r.topic_id)))problems.push("Row "+line+": invalid topic_id.");
   });
   const p1=normalized.filter(r=>String(r.paper_id)===PAPER1_ID).length,p2=normalized.filter(r=>String(r.paper_id)===PAPER2_ID).length;
   if(normalized.length!==150)problems.unshift("Exactly 150 questions are required. Uploaded: "+normalized.length+".");
   if(p1!==50)problems.push("Paper 1 must contain exactly 50 questions. Found: "+p1+".");
   if(p2!==100)problems.push("Paper 2 must contain exactly 100 questions. Found: "+p2+".");
   const ordered=[...normalized.filter(r=>String(r.paper_id)===PAPER1_ID),...normalized.filter(r=>String(r.paper_id)===PAPER2_ID)];
   setRows(ordered);setErrors(problems);
  }catch{setErrors(["Could not read workbook. Upload a valid .xlsx or .xls file."]);} })();
  e.target.value="";
 }
 async function saveDraft(){
  if(!db||!rows.length||errors.length||!title.trim()||!examId||!subjectId)return;
  setBusy(true);setMessage("");
  const {data,error}=await db.rpc("admin_create_full_length_draft",{p_test:{title:title.trim(),description:description.trim(),exam_id:examId,paper1_id:PAPER1_ID,paper2_id:PAPER2_ID,paper2_subject_id:subjectId},p_rows:rows});
  setBusy(false);if(error){setMessage(error.message);return;}setDraftId(data);setMessage("Draft saved. Review the 150-question preview below, then publish.");}
 async function publish(){
  if(!db||!draftId||published)return;
  if(!window.confirm("Publish this fixed Full-Length Test? After publishing, its 150 questions and order cannot be changed."))return;
  setBusy(true);const {data,error}=await db.rpc("admin_publish_full_length_test",{p_test_id:draftId});setBusy(false);
  if(error){setMessage(error.message);return;}setPublished(true);setMessage("Published successfully. New questions added to Question Bank: "+data.added_to_question_bank+". Existing duplicates reused: "+data.duplicates_reused+".");
 }
 if(checking)return <MockMasterLoading variant="admin" title="Verifying administrator access"/>;
 if(!admin)return <main className="fl-state"><h1>Administrator access required</h1><button onClick={()=>router.replace("/admin/login")}>Admin login</button></main>;
 return <main className="fl-shell">
  <AdminNavigation onSignOut={async()=>{await db?.auth.signOut();router.replace("/admin/login");}}/>
  <div className="fl-content">
   <div className="fl-head"><div><span>ASSESSMENT MANAGEMENT</span><h1>Full-Length Tests</h1><p>Create a fixed 150-question UGC NET mock using the existing Question Bank Excel format.</p></div><Link href="/admin/tests">← Test Builder</Link></div>
   {message&&<div className="fl-message" role="status">{message}</div>}
   <section className="fl-panel">
    <h2>1. Test details</h2>
    <div className="fl-fields"><label>Test title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Full Length Mock Test 01"/></label><label>Examination<select value={examId} onChange={e=>{setExamId(e.target.value);setRows([]);setDraftId("");}}>{exams.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Paper 2 subject<select value={subjectId} onChange={e=>{setSubjectId(e.target.value);setRows([]);setDraftId("");}}>{paper2Subjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
    <label className="fl-wide">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Optional description for students"/></label>
   </section>
   <section className="fl-panel">
    <h2>2. Upload question Excel</h2><p className="fl-muted">Use the same template as Question Bank → Excel Import. Questions must have the selected exam, Paper 1/Paper 2 IDs, subject IDs and unit/topic mapping.</p>
    <label className="fl-upload"><input type="file" accept=".xlsx,.xls" onChange={readExcel} disabled={!!draftId}/><strong>{fileName||"Choose Excel file"}</strong><span>{draftId?"Draft already saved":"Upload the existing Question Bank format"}</span></label>
    <div className="fl-counts"><div><b>{counts.p1}/50</b><span>Paper 1</span></div><div><b>{counts.p2}/100</b><span>Paper 2</span></div><div><b>{rows.length}/150</b><span>Total questions</span></div></div>
    {errors.length>0&&<div className="fl-errors"><b>Validation errors ({errors.length})</b><ul>{errors.slice(0,30).map((x,i)=><li key={i}>{x}</li>)}</ul>{errors.length>30&&<small>Showing first 30 errors.</small>}</div>}
    {rows.length===150&&errors.length===0&&<div className="fl-valid">✓ Exactly 150 questions validated — 50 Paper 1 + 100 Paper 2.</div>}
    {!draftId&&<button className="fl-primary" disabled={busy||!rows.length||!!errors.length||!title.trim()||!subjectId} onClick={()=>void saveDraft()}>{busy?"Saving draft…":"Save as draft & preview"}</button>}
   </section>
   {rows.length>0&&<section className="fl-panel">
    <div className="fl-preview-head"><div><h2>3. Question preview</h2><p>Questions are shown in final test order. Paper 1 first, then Paper 2.</p></div><span>{rows.length} questions</span></div>
    <div className="fl-question-list">{rows.map((r,i)=><article key={i} className="fl-question"><div className="fl-qtop"><b>Q{i+1}</b><span>{r.paper_id===PAPER1_ID?"Paper 1":"Paper 2"} · {r.difficulty||"moderate"}</span></div><p>{r.question}</p>{r.stimulus&&<blockquote>{r.stimulus}</blockquote>}<ol type="A">{["option_a","option_b","option_c","option_d"].map(k=><li key={k}>{r[k]}</li>)}</ol><small>Correct answer: <b>{r.correct_answer||r.answer_key_json}</b> · Unit ID: {r.unit_id||"Not mapped"}</small>{r.explanation&&<details><summary>Explanation</summary><p>{r.explanation}</p></details>}</article>)}</div>
    {draftId&&<div className="fl-publish"><p>Once published, this test is locked. The questions are added to the Question Bank; duplicate questions are reused, not added again.</p><button className="fl-primary" disabled={busy||published} onClick={()=>void publish()}>{busy?"Publishing…":published?"Published":"Publish Full-Length Test"}</button></div>}
   </section>}
  </div>
 </main>;
}
