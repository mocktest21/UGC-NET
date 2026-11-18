"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import "./admin-questions.css";

type Taxonomy = { id: string; code?: string | null; name: string; paper_id?: string; subject_id?: string; unit_id?: string; unit_number?: number | null };
type QuestionRow = { id: string; status: string; question_type: string; difficulty: string | null; created_at: string; paper_id:string; unit_id:string|null; subject_id:string; question_text:string; paper_name:string; unit_name:string };
type ImportRow = Record<string, unknown>;

const QUESTION_TYPES = [
  ["single_choice", "Single choice"], ["multiple_choice", "Multiple choice"],
  ["assertion_reason", "Assertion–Reason"], ["matching", "Matching"],
  ["passage", "Passage-based"], ["numerical", "Numerical"],
  ["short_answer", "Short answer"], ["ordering", "Ordering"], ["true_false", "True / False"],
];
const EMPTY_JSON = "{}";

export default function AdminQuestionsPage() {
  const router = useRouter();
  const [supabase] = useState(() => (typeof window === "undefined" ? null : createSupabaseBrowserClient()) as ReturnType<typeof createSupabaseBrowserClient>);
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [tab, setTab] = useState<"bank" | "create" | "import">("bank");
  const [exams, setExams] = useState<Taxonomy[]>([]);
  const [papers, setPapers] = useState<Taxonomy[]>([]);
  const [subjects, setSubjects] = useState<Taxonomy[]>([]);
  const [units, setUnits] = useState<Taxonomy[]>([]);
  const [topics, setTopics] = useState<Taxonomy[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [bankPaperFilter,setBankPaperFilter]=useState("");
  const [bankUnitFilter,setBankUnitFilter]=useState("");
  const [bankUnits,setBankUnits]=useState<Taxonomy[]>([]);
  const [bankSubjects,setBankSubjects]=useState<Taxonomy[]>([]);
  const [deletingQuestion,setDeletingQuestion]=useState<string|null>(null);
  const [selectedForApproval, setSelectedForApproval] = useState<string[]>([]);
  const [selectedForReview, setSelectedForReview] = useState<string[]>([]);
  const [bulkSendingForReview, setBulkSendingForReview] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [loadingBank, setLoadingBank] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [examId, setExamId] = useState("");
  const [paperId, setPaperId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [type, setType] = useState("single_choice");
  const [difficulty, setDifficulty] = useState("moderate");
  const [stem, setStem] = useState("");
  const [optionsText, setOptionsText] = useState("A. Option one\nB. Option two\nC. Option three\nD. Option four");
  const [answerText, setAnswerText] = useState('{"correct_option_id":"A"}');
  const [explanation, setExplanation] = useState("");
  const [marks, setMarks] = useState("2");
  const [negativeMarks, setNegativeMarks] = useState("0.5");
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceYear, setSourceYear] = useState("");
  const [fileName, setFileName] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let alive = true;
    async function initialise() {
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      if (error || !data.user) { router.replace("/admin/login"); return; }
      if (data.user.app_metadata?.role !== "admin") {
        setChecking(false);
        setAdmin(false);
        return;
      }
      setAdmin(true);
      const { data: examData } = await supabase.from("exams").select("id,code,name").eq("is_active", true).order("display_order");
      if (alive) {
        const rows = (examData || []) as Taxonomy[];
        setExams(rows);
        if (rows[0]) setExamId(rows[0].id);
      }
      setChecking(false);
    }
    void initialise();
    return () => { alive = false; };
  }, [router, supabase]);

  useEffect(() => {
    if (!admin || !examId) return;
    void (async () => {
      const { data } = await supabase.from("papers").select("id,code,name").eq("exam_id", examId).eq("is_active", true).order("display_order");
      setPapers((data || []) as Taxonomy[]);
      setPaperId("");
      setSubjectId("");
      setUnitId("");
    })();
  }, [admin, examId, supabase]);

  useEffect(() => {
    if (!admin || !paperId) { setSubjects([]); return; }
    void (async () => {
      const { data } = await supabase.from("subjects").select("id,code,name,paper_id").eq("paper_id", paperId).eq("is_active", true).order("display_order");
      setSubjects((data || []) as Taxonomy[]);
      setSubjectId("");
    })();
  }, [admin, paperId, supabase]);

  useEffect(() => {
    if (!admin || !subjectId) { setUnits([]); return; }
    void (async () => {
      const { data } = await supabase.from("units").select("id,unit_number,name,subject_id").eq("subject_id", subjectId).eq("is_active", true).order("unit_number");
      setUnits((data || []) as Taxonomy[]);
      setUnitId("");
    })();
  }, [admin, subjectId, supabase]);

  useEffect(() => {
    if (!admin || !unitId) { setTopics([]); return; }
    void (async () => {
      const { data } = await supabase.from("topics").select("id,name,unit_id").eq("unit_id", unitId).eq("is_active", true).order("display_order");
      setTopics((data || []) as Taxonomy[]);
      setTopicId("");
    })();
  }, [admin, unitId, supabase]);

  async function loadQuestions() {
    setLoadingBank(true);
    let query = supabase.from("questions").select("id,status,question_type,difficulty,created_at,paper_id,unit_id,subject_id").order("created_at", { ascending: false }).limit(500);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (bankPaperFilter) query=query.eq("paper_id",bankPaperFilter);
    if (bankUnitFilter) query=query.eq("unit_id",bankUnitFilter);
    const { data, error } = await query;
    if (error) {setMessage(error.message);setLoadingBank(false);return;}
    const rows=(data||[]) as any[];
    const ids=rows.map(q=>q.id);
    const [{data:versions,error:versionError},{data:paperRows},{data:subjectRows}]=await Promise.all([
      ids.length?supabase.from("question_versions").select("question_id,version_number,prompt").in("question_id",ids).order("version_number",{ascending:false}):Promise.resolve({data:[],error:null}),
      supabase.from("papers").select("id,name"),
      supabase.from("subjects").select("id,name")
    ]);
    if(versionError){setMessage(versionError.message);setLoadingBank(false);return;}
    const latest=new Map<string,any>();(versions||[]).forEach((v:any)=>{if(!latest.has(v.question_id))latest.set(v.question_id,v);});
    const paperMap=new Map((paperRows||[]).map((x:any)=>[x.id,x.name]));
    const subjectMap=new Map((subjectRows||[]).map((x:any)=>[x.id,x.name]));
    const unitMap=new Map(bankUnits.map(x=>[x.id,x]));
    setQuestions(rows.map(q=>({ ...q,
      question_text:String(latest.get(q.id)?.prompt?.stem?.text||latest.get(q.id)?.prompt?.text||latest.get(q.id)?.prompt?.stem||"Question text unavailable"),
      paper_name:String(paperMap.get(q.paper_id)||"Paper"),
      unit_name:q.unit_id?String(unitMap.get(q.unit_id)?.name||"Unit"): "Unassigned"
    })) as QuestionRow[]);
    setLoadingBank(false);
  }

  useEffect(() => { if (admin) void loadQuestions(); }, [admin, statusFilter, bankPaperFilter, bankUnitFilter, bankUnits]);

  useEffect(() => {
    const reviewIds = new Set(questions.filter((q) => q.status === "in_review").map((q) => q.id));
    setSelectedForApproval((current) => current.filter((id) => reviewIds.has(id)));
    const draftIds = new Set(questions.filter((q) => q.status === "draft").map((q) => q.id));
    setSelectedForReview((current) => current.filter((id) => draftIds.has(id)));
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter((item) => [item.id, item.question_type, item.status, item.difficulty || ""].some((v) => v.toLowerCase().includes(q)));
  }, [questions, search]);

  function parseOptions() {
    if (["numerical", "short_answer", "true_false", "passage"].includes(type)) return [];
    return optionsText.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => {
      const match = line.match(/^([A-Z0-9]+)[.)-]\s*(.*)$/);
      return { id: match?.[1] || String.fromCharCode(65 + index), text: match?.[2] || line };
    });
  }

  async function changeQuestionStatus(questionId: string, nextStatus: string) {
    setMessage("");
    const { error } = await supabase.rpc("admin_set_question_status", { p_question_id: questionId, p_status: nextStatus });
    if (error) setMessage(error.message);
    else { setMessage(`Question moved to ${nextStatus.replaceAll("_", " ")}.`); await loadQuestions(); }
  }

  async function bulkApproveSelected() {
    if (!selectedForApproval.length || bulkApproving) return;
    const count = selectedForApproval.length;
    if (!window.confirm(`Approve ${count} selected question${count === 1 ? "" : "s"}? Approved questions may become available to students.`)) return;
    setBulkApproving(true);
    setMessage("");
    const { data, error } = await supabase.rpc("admin_bulk_approve_questions", { p_question_ids: selectedForApproval });
    setBulkApproving(false);
    if (error) { setMessage(error.message); return; }
    const approved = Number(data?.approved || 0);
    const failed = Array.isArray(data?.errors) ? data.errors : [];
    setSelectedForApproval([]);
    setMessage(`Bulk approval complete. Approved: ${approved}. Failed: ${failed.length}. ${failed.slice(0, 3).map((item: any) => `Question ${String(item.question_id).slice(0, 8)}: ${item.message}`).join(" | ")}`);
    await loadQuestions();
  }

  async function bulkSendToReview() {
    if (!selectedForReview.length || bulkSendingForReview) return;
    const count = selectedForReview.length;
    if (!window.confirm(`Send ${count} selected draft question${count === 1 ? "" : "s"} to review?`)) return;
    setBulkSendingForReview(true);
    setMessage("");
    const { data, error } = await supabase.rpc("admin_bulk_send_questions_to_review", { p_question_ids: selectedForReview });
    setBulkSendingForReview(false);
    if (error) { setMessage(error.message); return; }
    const sent = Number(data?.sent_to_review || 0);
    const failed = Array.isArray(data?.errors) ? data.errors : [];
    setSelectedForReview([]);
    setMessage(`Bulk send to review complete. Sent: ${sent}. Failed: ${failed.length}. ${failed.slice(0, 3).map((item: any) => `Question ${String(item.question_id).slice(0, 8)}: ${item.message}`).join(" | ")}`);
    await loadQuestions();
  }

  async function deleteQuestion(questionId:string) {
    const row=questions.find(q=>q.id===questionId);
    if(!row||deletingQuestion)return;
    if(!window.confirm("Permanently delete this uploaded question? This cannot be undone. Questions already attached to a test cannot be deleted."))return;
    setDeletingQuestion(questionId);setMessage("");
    const {data,error}=await supabase.rpc("admin_delete_question",{p_question_id:questionId});
    setDeletingQuestion(null);
    if(error){setMessage(error.message);return;}
    setMessage("Question permanently deleted from the question bank.");
    setSelectedForApproval(current=>current.filter(id=>id!==questionId));
    setSelectedForReview(current=>current.filter(id=>id!==questionId));
    await loadQuestions();
  }

  async function createQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    let answerKey: Record<string, unknown>;
    try { answerKey = JSON.parse(answerText); }
    catch { setMessage("Answer key must be valid JSON."); return; }
    if (!examId || !paperId || !subjectId || !stem.trim()) { setMessage("Select the examination, paper, subject and enter the question."); return; }
    setSaving(true);
    const options = parseOptions();
    const { data, error } = await supabase.rpc("admin_create_question", {
      p_question: {
        exam_id: examId, paper_id: paperId, subject_id: subjectId,
        unit_id: unitId || null, topic_id: topicId || null,
        question_type: type, difficulty, language_code: "en",
        source_label: sourceLabel || null, source_year: sourceYear || null,
        source_type: sourceLabel ? "previous_year" : "admin_created", tags: [],
      },
      p_version: {
        prompt: { stem: { text: stem, html: null }, instructions: null, assets: [] },
        options,
        explanation: explanation.trim() ? { text: explanation.trim() } : null,
        default_marks: Number(marks), default_negative_marks: Number(negativeMarks),
      },
      p_answer_key: answerKey,
    });
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setMessage("Question saved as Draft. It is not yet available to students.");
    setStem(""); setExplanation(""); setSourceLabel(""); setSourceYear("");
    setTab("bank");
    await loadQuestions();
  }


  const MASTER_COLUMNS = ["question_id","exam_id","paper_id","subject_id","unit_id","topic_id","question_type","difficulty","language_code","source_type","source_label","source_year","question","options_json","answer_key_json","explanation","marks","negative_marks","status"];
  function parseJsonCell(value: unknown, fallback: unknown) {
    if (value === undefined || value === null || String(value).trim() === "") return fallback;
    if (typeof value === "object") return value;
    try { return JSON.parse(String(value)); } catch { return fallback; }
  }
  async function downloadMasterExcel() {
    const columns = ["exam_id","paper_id","subject_id","unit_id","topic_id","question_format","question","stimulus","list_i","list_ii","option_a","option_b","option_c","option_d","correct_answer","explanation","difficulty","marks","negative_marks","source_label","source_year"];
    const sample = {
      exam_id: "Paste exam ID", paper_id: "Paste paper ID", subject_id: "Paste subject ID",
      unit_id: "", topic_id: "", question_format: "matching",
      question: "Match the following items:", stimulus: "",
      list_i: "A. First item\\nB. Second item", list_ii: "1. First match\\n2. Second match",
      option_a: "A. A-1, B-2", option_b: "B. A-2, B-1", option_c: "C. A-1, B-1", option_d: "D. A-2, B-2",
      correct_answer: "A", explanation: "Explain the correct match.",
      difficulty: "moderate", marks: 2, negative_marks: 0.5, source_label: "", source_year: ""
    };
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([sample], { header: columns });
    ws["!cols"] = columns.map((h) => ({ wch: Math.max(14, Math.min(30, h.length + 5)) }));
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    const guide = XLSX.utils.aoa_to_sheet([
      ["MOCKMASTER SIMPLE QUESTION TEMPLATE"],
      ["One question per row. Delete the sample row before adding your own questions."],
      ["Required: exam_id, paper_id, subject_id, question, option_a to option_d, correct_answer."],
      ["Use taxonomy IDs from your existing Question Bank. unit_id and topic_id are optional."],
      ["question_format is for the presentation style (e.g. single_mcq, multiple_statement, matching, assertion_reason, passage, chronology, data_interpretation, numerical, case_study)."],
      ["For matching: fill list_i and list_ii, then write four complete matching combinations in option_a to option_d."],
      ["For passage/case/data questions: put shared text or data in stimulus. Repeat it for each linked question row."],
      ["correct_answer must be one letter only: A, B, C or D. Students always select one option."],
      ["No JSON is required. Imported questions are saved as Draft for review."],
      ["Supported difficulty values: easy, moderate, hard. Default marks: 2; negative marks: 0."]
    ]);
    XLSX.utils.book_append_sheet(wb, guide, "Read Me");
    XLSX.writeFile(wb, "MockMaster_Simple_Question_Template.xlsx", { compression: true });
    setMessage("Simple Excel template downloaded. Fill one question per row; no JSON formatting is needed.");
  }

  async function importMasterRows() {
    if(!importRows.length||importErrors.length)return;
    setImporting(true);setMessage("");
    let added=0,duplicates=0,existingSkipped=0;const errors:string[]=[];const seen=new Set<string>();
    try {
      const existingIds=new Set<string>(), existingFingerprints=new Set<string>();
      const bankRows:any[]=[];
      for(let from=0;;from+=1000){
        const {data,error}=await supabase.from("questions").select("id,exam_id,paper_id,subject_id,unit_id").range(from,from+999);
        if(error)throw error;(data||[]).forEach(q=>{existingIds.add(q.id);bankRows.push(q);});if(!data||data.length<1000)break;
      }
      for(let i=0;i<bankRows.length;i+=500){
        const chunk=bankRows.slice(i,i+500), ids=chunk.map(q=>q.id);
        const {data,error}=await supabase.from("question_versions").select("question_id,prompt").in("question_id",ids).order("version_number",{ascending:false});
        if(error)throw error;
        const latest=new Map<string,any>();(data||[]).forEach(v=>{if(!latest.has(v.question_id))latest.set(v.question_id,v);});
        chunk.forEach(q=>{const prompt=latest.get(q.id)?.prompt;const stem=prompt?.stem?.text||prompt?.text||"";const normal=(v:unknown)=>String(v??"").toLowerCase().replace(/\\s+/g," ").trim();existingFingerprints.add([q.exam_id,q.paper_id,q.subject_id,q.unit_id,stem].map(normal).join("|"));});
      }
      const pendingItems:any[]=[];
      for(let index=0;index<importRows.length;index++){
        const row=importRows[index], rowNo=index+2;
        const id=String(row.question_id||"").trim();
        if(id&&existingIds.has(id)){existingSkipped++;continue;}
        const normal=(v:unknown)=>String(v??"").toLowerCase().replace(/\\s+/g," ").trim();
        const fingerprint=[row.exam_id,row.paper_id,row.subject_id,row.unit_id,row.question].map(normal).join("|");
        if(seen.has(fingerprint)||existingFingerprints.has(fingerprint)){duplicates++;continue;} seen.add(fingerprint);
        const options=parseJsonCell(row.options_json,["option_a","option_b","option_c","option_d"].filter(k=>String(row[k]||"").trim()).map((k,i)=>({id:String.fromCharCode(65+i),text:String(row[k]).replace(/^[A-D][.)-]\\s*/,"")})));
        const answerLetter=String(row.correct_answer||"").trim().toUpperCase();
        let answer=parseJsonCell(row.answer_key_json,null);
        if(!answer) answer={correct_option_id:answerLetter};
        const questionText=[String(row.question||"").trim(),String(row.stimulus||"").trim(),String(row.list_i||"").trim()? "List I:\\n"+String(row.list_i).trim():"",String(row.list_ii||"").trim()? "List II:\\n"+String(row.list_ii).trim():""].filter(Boolean).join("\\n\\n");
        if(!row.exam_id||!row.paper_id||!row.subject_id||!questionText||!answerLetter.match(/^[A-D]$/)||!Array.isArray(options)||options.length!==4){errors.push("Row "+rowNo+": enter taxonomy IDs, question, four options and one correct_answer (A-D).");continue;}
        pendingItems.push({
          row_number:rowNo,
          question:{exam_id:String(row.exam_id),paper_id:String(row.paper_id),subject_id:String(row.subject_id),unit_id:String(row.unit_id||"")||null,topic_id:String(row.topic_id||"")||null,question_type:"single_choice",difficulty:(["easy","moderate","hard"].includes(String(row.difficulty||"moderate").trim().toLowerCase())?String(row.difficulty||"moderate").trim().toLowerCase():"moderate"),language_code:String(row.language_code||"en"),source_type:String(row.source_type||"admin_created"),source_label:String(row.source_label||"")||null,source_year:String(row.source_year||"")||null,tags:[]},
          version:{prompt:{stem:{text:questionText,html:null},instructions:String(row.question_format||"single_mcq"),assets:[]},options,explanation:String(row.explanation||"").trim()?{text:String(row.explanation)}:null,default_marks:Number(row.marks||2),default_negative_marks:Number(row.negative_marks||0)},
          answer_key:answer
        });
      }
      for(let i=0;i<pendingItems.length;i+=50){
        const {data,error}=await supabase.rpc("admin_import_questions_bulk",{p_items:pendingItems.slice(i,i+50)});
        if(error)throw error;
        added+=Number(data?.added||0);
        (data?.errors||[]).forEach((item:any)=>errors.push("Row "+item.row_number+": "+item.message));
      }
      setMessage("Import complete. Added: "+added+". Duplicate rows skipped: "+duplicates+". Existing IDs skipped: "+existingSkipped+". Errors: "+errors.length+". "+errors.slice(0,5).join(" | "));
      setImportRows([]);setImportErrors([]);setFileName("");setTab("bank");await loadQuestions();
    } catch(e:any){setMessage(e?.message||"Import failed. Existing questions were not deleted.");}
    finally{setImporting(false);}
  }

  async function readWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportErrors([]);
    setImportRows([]);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const uploadSheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === "final upload");
      const selectedSheetName = uploadSheetName || workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[selectedSheetName];
      const rawRows = XLSX.utils.sheet_to_json<ImportRow>(firstSheet, { defval: "", raw: false });
      const rows = rawRows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value])) as ImportRow);
      const required = ["question", "exam_id", "paper_id", "subject_id"];
      const headers = rows[0] ? Object.keys(rows[0]).map((h) => h.trim().toLowerCase()) : [];
      const errors: string[] = [];
      required.forEach((column) => { if (!headers.includes(column)) errors.push(`Missing required column: ${column}`); });
      if (!rows.length) errors.push("The first worksheet is empty.");
      rows.forEach((row, index) => {
        if (!String(row.question || "").trim()) errors.push(`Row ${index + 2}: question is blank.`);
        if (!String(row.correct_answer || row.answer_key_json || "").trim()) errors.push("Row "+(index+2)+": correct_answer is blank.");
      });
      setImportRows(rows);
      setImportErrors(errors);
    } catch {
      setImportErrors(["Could not read this workbook. Upload a valid .xlsx or .xls file."]);
    }
    event.target.value = "";
  }

  async function stageImport() {
    if (!importRows.length || importErrors.length) return;
    setImporting(true);
    const { data, error } = await supabase.rpc("admin_stage_question_import", { p_filename: fileName, p_rows: importRows });
    setImporting(false);
    if (error) { setMessage(error.message); return; }
    setMessage(`Import staged successfully. Batch ID: ${data}. Rows are in review staging; they have not been added to the live question bank.`);
    setImportRows([]);
    setImportErrors([]);
    setFileName("");
  }

  if (checking) return <main className="aq-state">Checking administrator access…</main>;
  if (!admin) return <main className="aq-state"><div className="aq-denied"><span>403</span><h1>Administrator access required</h1><p>This area is restricted to authorised MockMaster administrators.</p><button onClick={async () => { await supabase.auth.signOut(); router.replace("/admin/login"); }}>Go to admin login</button><button onClick={() => router.replace("/dashboard")}>Return to dashboard</button></div></main>;

  return (
    <main className="aq-shell">
      <header className="aq-header">
        <a className="aq-brand" href="/admin"><span>M</span> MockMaster <small>ADMIN</small></a>
        <div className="aq-header-right"><a href="/admin">Admin overview</a><a href="/dashboard">Student site ↗</a><button onClick={async () => { await supabase.auth.signOut(); router.replace("/admin/login"); }}>Sign out</button></div>
      </header>
      <div className="aq-layout">
        <aside className="aq-sidebar">
          <span className="aq-side-label">ADMINISTRATION</span>
          <a className="active" href="/admin/questions">▦ <span>Question Bank</span></a>
          <a href="/admin/questions?tab=import">⇧ <span>Excel Imports</span></a>
          <div className="aq-side-note"><b>Content control</b><p>Questions remain in Draft until reviewed and approved by an administrator.</p></div>
        </aside>
        <section className="aq-main">
          <div className="aq-title-row"><div><span className="aq-eyebrow">CONTENT MANAGEMENT</span><h1>Question Bank</h1><p>Create, organise and review your examination questions.</p></div><button className="aq-primary" onClick={() => setTab("create")}>＋ Add question</button></div>
          {message && <div className="aq-message" role="status">{message}<button onClick={() => setMessage("")}>×</button></div>}
          <div className="aq-tabs">
            <button className={tab === "bank" ? "selected" : ""} onClick={() => setTab("bank")}>All questions</button>
            <button className={tab === "create" ? "selected" : ""} onClick={() => setTab("create")}>Create question</button>
            <button className={tab === "import" ? "selected" : ""} onClick={() => setTab("import")}>Excel import</button>
          </div>

          {tab === "bank" && <section className="aq-card">
            <div className="aq-card-heading"><div><h2>Question repository</h2><p>Uploaded questions with paper-wise and unit-wise filtering. Showing up to 500 matching records.</p></div><button className="aq-secondary" onClick={() => void loadQuestions()}>↻ Refresh</button></div>
            <div className="aq-toolbar aq-bank-filters"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text, ID, type or status…" /><select aria-label="Filter by paper" value={bankPaperFilter} onChange={e=>{setBankPaperFilter(e.target.value);setBankUnitFilter("");}}><option value="">All papers</option>{papers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select aria-label="Filter by unit" value={bankUnitFilter} onChange={e=>setBankUnitFilter(e.target.value)}><option value="">All units</option>{bankUnits.filter(x=>!bankPaperFilter||bankSubjects.some(s=>s.id===x.subject_id&&s.paper_id===bankPaperFilter)).map(x=><option key={x.id} value={x.id}>Unit {x.unit_number}: {x.name}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="in_review">In review</option><option value="approved">Approved</option><option value="archived">Archived</option></select></div>
            {(selectedForApproval.length > 0 || selectedForReview.length > 0) && <div className="aq-form-footer"><p>{selectedForReview.length} draft(s) selected · {selectedForApproval.length} in-review question(s) selected.</p><div className="aq-row-actions">{selectedForReview.length > 0 && <button className="aq-primary" onClick={() => void bulkSendToReview()} disabled={bulkSendingForReview}>{bulkSendingForReview ? "Sending…" : `Send to review (${selectedForReview.length})`}</button>}{selectedForApproval.length > 0 && <button className="aq-primary" onClick={() => void bulkApproveSelected()} disabled={bulkApproving}>{bulkApproving ? "Approving…" : `Approve selected (${selectedForApproval.length})`}</button>}</div></div>}
            {loadingBank ? <div className="aq-empty">Loading question bank…</div> : filteredQuestions.length ? <div className="aq-table-wrap"><table className="aq-table"><thead><tr><th><input aria-label="Select all draft and in-review questions" type="checkbox" checked={filteredQuestions.some((q) => q.status === "draft" || q.status === "in_review") && filteredQuestions.filter((q) => q.status === "draft" || q.status === "in_review").every((q) => q.status === "draft" ? selectedForReview.includes(q.id) : selectedForApproval.includes(q.id))} onChange={(e) => { const eligible = filteredQuestions.filter((q) => q.status === "draft" || q.status === "in_review"); setSelectedForReview(e.target.checked ? eligible.filter((q) => q.status === "draft").map((q) => q.id) : []); setSelectedForApproval(e.target.checked ? eligible.filter((q) => q.status === "in_review").map((q) => q.id) : []); }} /></th><th>Question</th><th>Paper</th><th>Unit</th><th>Type</th><th>Difficulty</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{filteredQuestions.map((q) => <tr key={q.id}><td>{q.status === "draft" ? <input aria-label={`Select draft question ${q.id}`} type="checkbox" checked={selectedForReview.includes(q.id)} onChange={(e) => setSelectedForReview((current) => e.target.checked ? [...current, q.id] : current.filter((id) => id !== q.id))} /> : q.status === "in_review" ? <input aria-label={`Select question for approval ${q.id}`} type="checkbox" checked={selectedForApproval.includes(q.id)} onChange={(e) => setSelectedForApproval((current) => e.target.checked ? [...current, q.id] : current.filter((id) => id !== q.id))} /> : null}</td><td className="aq-question-cell"><div>{q.question_text}</div><small><code>{q.id.slice(0,8)}…</code></small></td><td>{q.paper_name}</td><td>{q.unit_name}</td><td>{q.question_type.replaceAll("_", " ")}</td><td>{q.difficulty || "—"}</td><td><span className={`aq-status aq-${q.status}`}>{q.status.replaceAll("_", " ")}</span></td><td>{new Date(q.created_at).toLocaleDateString()}</td><td><div className="aq-row-actions">{q.status === "draft" && <button onClick={() => void changeQuestionStatus(q.id, "in_review")}>Send to review</button>}{q.status === "in_review" && <><button onClick={() => void changeQuestionStatus(q.id, "approved")}>Approve</button><button onClick={() => void changeQuestionStatus(q.id, "draft")}>Return to draft</button></>}{q.status === "approved" && <button onClick={() => void changeQuestionStatus(q.id, "in_review")}>Reopen review</button>}{q.status !== "archived" && <button onClick={() => void changeQuestionStatus(q.id, "archived")}>Archive</button>}<button className="aq-delete-button" disabled={deletingQuestion===q.id} onClick={()=>void deleteQuestion(q.id)}>{deletingQuestion===q.id?"Deleting…":"Delete"}</button></div></td></tr>)}</tbody></table></div> : <div className="aq-empty"><span>▦</span><b>Your question bank is ready</b><p>No questions match this view. Add a question or import an Excel workbook to get started.</p><button className="aq-primary" onClick={() => setTab("create")}>Add your first question</button></div>}
          </section>}

          {tab === "create" && <form className="aq-card aq-form" onSubmit={createQuestion}>
            <div className="aq-card-heading"><div><h2>Create a question</h2><p>Each new question starts as Draft and receives an immutable version.</p></div><span className="aq-status aq-draft">DRAFT</span></div>
            <div className="aq-grid aq-grid-3">
              <label>Examination<select value={examId} onChange={(e) => setExamId(e.target.value)} required><option value="">Select exam</option>{exams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label>Paper<select value={paperId} onChange={(e) => setPaperId(e.target.value)} required><option value="">Select paper</option>{papers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label>Subject<select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required><option value="">Select subject</option>{subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label>Unit<select value={unitId} onChange={(e) => setUnitId(e.target.value)}><option value="">No unit selected</option>{units.map((x) => <option key={x.id} value={x.id}>Unit {x.unit_number}: {x.name}</option>)}</select></label>
              <label>Topic<select value={topicId} onChange={(e) => setTopicId(e.target.value)}><option value="">No topic selected</option>{topics.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label>Question type<select value={type} onChange={(e) => { setType(e.target.value); setAnswerText(e.target.value === "true_false" ? '{"value":true}' : e.target.value === "multiple_choice" ? '{"correct_option_ids":["A","C"]}' : e.target.value === "numerical" ? '{"accepted_value":42,"tolerance":0.01}' : '{"correct_option_id":"A"}'); }}>{QUESTION_TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
              <label>Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="hard">Hard</option></select></label>
              <label>Marks<input type="number" min="0" step="0.25" value={marks} onChange={(e) => setMarks(e.target.value)} required /></label>
              <label>Negative marks<input type="number" min="0" step="0.25" value={negativeMarks} onChange={(e) => setNegativeMarks(e.target.value)} required /></label>
            </div>
            <label className="aq-full">Question statement<textarea value={stem} onChange={(e) => setStem(e.target.value)} rows={5} placeholder="Enter the complete question statement…" required /></label>
            {!["numerical", "short_answer", "true_false", "passage"].includes(type) && <label className="aq-full">Options <small>One option per line. Format: A. Option text</small><textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={5} /></label>}
            <div className="aq-grid aq-grid-2">
              <label>Answer key (JSON)<textarea className="aq-code-input" value={answerText} onChange={(e) => setAnswerText(e.target.value)} rows={4} required /></label>
              <label>Explanation<textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={4} placeholder="Explain why the answer is correct…" /></label>
            </div>
            <div className="aq-grid aq-grid-2">
              <label>Source / PYQ exam label<input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="e.g. UGC NET June 2025" /></label>
              <label>Source year<input type="number" min="1950" max="2100" value={sourceYear} onChange={(e) => setSourceYear(e.target.value)} placeholder="2025" /></label>
            </div>
            <div className="aq-form-footer"><p>Answer keys are stored separately from student-readable question content.</p><button className="aq-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save as draft"}</button></div>
          </form>}

          {tab === "import" && <section className="aq-card">
            <div className="aq-card-heading"><div><h2>Master Question Bank Excel</h2><p>Use a simple one-question-per-row workbook. No JSON fields or formatting are required.</p></div><span className="aq-status aq-review">MASTER FILE</span></div><div className="aq-master-actions"><div><b>1. Download simple Excel template</b><p>Includes clear columns for question, four options, correct answer and optional matching/passage content.</p><button className="aq-primary" onClick={() => void downloadMasterExcel()}>↓ Download Master Excel</button></div><div><b>2. Upload completed workbook</b><p>Fill the taxonomy IDs, add one question per row and upload. New questions are saved as Draft.</p></div></div>
            <div className="aq-import-drop"><div className="aq-upload-icon">⇧</div><b>{fileName || "Choose an Excel workbook"}</b><p>Maximum 5,000 rows per import batch. Files are parsed in your browser; only row data is sent to Supabase staging.</p><label className="aq-secondary aq-file-button">Browse files<input type="file" accept=".xlsx,.xls" onChange={readWorkbook} /></label></div>
            <div className="aq-template"><b>Simple Excel rules</b><p><code>question</code> · <code>option_a</code>–<code>option_d</code> · <code>correct_answer</code> · <code>question_format</code></p><small>For matching, fill List I and List II plus four matching combinations. The correct answer is one letter (A–D). Imported questions enter Draft status.</small></div>
            {importErrors.length > 0 && <div className="aq-errors"><b>Validation issues ({importErrors.length})</b><ul>{importErrors.slice(0, 12).map((e) => <li key={e}>{e}</li>)}</ul></div>}
            {importRows.length > 0 && <><div className="aq-preview-head"><b>Preview · {importRows.length} rows</b><span>{importErrors.length ? "Fix the workbook and upload again" : "Basic validation passed"}</span></div><div className="aq-table-wrap"><table className="aq-table"><thead><tr>{Object.keys(importRows[0]).slice(0, 5).map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{importRows.slice(0, 5).map((row, i) => <tr key={i}>{Object.keys(importRows[0]).slice(0, 5).map((h) => <td key={h}>{String(row[h] ?? "").slice(0, 100)}</td>)}</tr>)}</tbody></table></div><div className="aq-form-footer"><p>Only new rows are created. Existing questions are not updated, deleted or automatically approved.</p><button className="aq-primary" disabled={!!importErrors.length || importing} onClick={() => void importMasterRows()}>{importing ? "Importing…" : "Import new questions"}</button></div></>}
          </section>}
          <footer className="aq-footer">MockMaster Admin · Question content and answer keys are access-controlled.</footer>
        </section>
      </div>
    </main>
  );
}
