"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import "./admin-questions.css";

type Taxonomy = { id: string; code?: string | null; name: string; paper_id?: string; subject_id?: string; unit_id?: string; unit_number?: number | null };
type QuestionRow = { id: string; status: string; question_type: string; difficulty: string | null; created_at: string };
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
    let query = supabase.from("questions").select("id,status,question_type,difficulty,created_at").order("created_at", { ascending: false }).limit(200);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data, error } = await query;
    if (error) setMessage(error.message);
    else setQuestions((data || []) as QuestionRow[]);
    setLoadingBank(false);
  }

  useEffect(() => { if (admin) void loadQuestions(); }, [admin, statusFilter]);

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

  async function readWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportErrors([]);
    setImportRows([]);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<ImportRow>(firstSheet, { defval: "", raw: false });
      const rows = rawRows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value])) as ImportRow);
      const required = ["question", "correct_answer"];
      const headers = rows[0] ? Object.keys(rows[0]).map((h) => h.trim().toLowerCase()) : [];
      const errors: string[] = [];
      required.forEach((column) => { if (!headers.includes(column)) errors.push(`Missing required column: ${column}`); });
      if (!rows.length) errors.push("The first worksheet is empty.");
      rows.forEach((row, index) => {
        if (!String(row.question || "").trim()) errors.push(`Row ${index + 2}: question is blank.`);
        if (!String(row.correct_answer || "").trim()) errors.push(`Row ${index + 2}: correct_answer is blank.`);
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
            <div className="aq-card-heading"><div><h2>Question repository</h2><p>Latest 200 records across your question bank.</p></div><button className="aq-secondary" onClick={() => void loadQuestions()}>↻ Refresh</button></div>
            <div className="aq-toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, type or status…" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="in_review">In review</option><option value="approved">Approved</option><option value="archived">Archived</option></select></div>
            {loadingBank ? <div className="aq-empty">Loading question bank…</div> : filteredQuestions.length ? <div className="aq-table-wrap"><table className="aq-table"><thead><tr><th>Question ID</th><th>Question type</th><th>Difficulty</th><th>Status</th><th>Created</th><th>Review action</th></tr></thead><tbody>{filteredQuestions.map((q) => <tr key={q.id}><td><code>{q.id.slice(0, 8)}…</code></td><td>{q.question_type.replaceAll("_", " ")}</td><td>{q.difficulty || "—"}</td><td><span className={`aq-status aq-${q.status}`}>{q.status.replaceAll("_", " ")}</span></td><td>{new Date(q.created_at).toLocaleDateString()}</td><td><div className="aq-row-actions">{q.status === "draft" && <button onClick={() => void changeQuestionStatus(q.id, "in_review")}>Send to review</button>}{q.status === "in_review" && <><button onClick={() => void changeQuestionStatus(q.id, "approved")}>Approve</button><button onClick={() => void changeQuestionStatus(q.id, "draft")}>Return to draft</button></>}{q.status === "approved" && <button onClick={() => void changeQuestionStatus(q.id, "in_review")}>Reopen review</button>}{q.status !== "archived" && <button onClick={() => void changeQuestionStatus(q.id, "archived")}>Archive</button>}</div></td></tr>)}</tbody></table></div> : <div className="aq-empty"><span>▦</span><b>Your question bank is ready</b><p>No questions match this view. Add a question or import an Excel workbook to get started.</p><button className="aq-primary" onClick={() => setTab("create")}>Add your first question</button></div>}
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
            <div className="aq-card-heading"><div><h2>Excel question import</h2><p>Upload .xlsx or .xls files. The first worksheet is read for preview and validation.</p></div><span className="aq-status aq-review">STAGING</span></div>
            <div className="aq-import-drop"><div className="aq-upload-icon">⇧</div><b>{fileName || "Choose an Excel workbook"}</b><p>Maximum 5,000 rows per import batch. Files are parsed in your browser; only row data is sent to Supabase staging.</p><label className="aq-secondary aq-file-button">Browse files<input type="file" accept=".xlsx,.xls" onChange={readWorkbook} /></label></div>
            <div className="aq-template"><b>Expected columns</b><p><code>question</code> · <code>correct_answer</code> · <code>option_a</code> · <code>option_b</code> · <code>option_c</code> · <code>option_d</code> · <code>question_type</code> · <code>exam_code</code> · <code>paper_code</code> · <code>subject_code</code> · <code>unit_number</code> · <code>explanation</code> · <code>marks</code> · <code>negative_marks</code></p><small>Column headers are case-insensitive. Required for staging validation: question and correct_answer.</small></div>
            {importErrors.length > 0 && <div className="aq-errors"><b>Validation issues ({importErrors.length})</b><ul>{importErrors.slice(0, 12).map((e) => <li key={e}>{e}</li>)}</ul></div>}
            {importRows.length > 0 && <><div className="aq-preview-head"><b>Preview · {importRows.length} rows</b><span>{importErrors.length ? "Fix the workbook and upload again" : "Basic validation passed"}</span></div><div className="aq-table-wrap"><table className="aq-table"><thead><tr>{Object.keys(importRows[0]).slice(0, 5).map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{importRows.slice(0, 5).map((row, i) => <tr key={i}>{Object.keys(importRows[0]).slice(0, 5).map((h) => <td key={h}>{String(row[h] ?? "").slice(0, 100)}</td>)}</tr>)}</tbody></table></div><div className="aq-form-footer"><p>Staging does not publish or add questions to the student question bank.</p><button className="aq-primary" disabled={!!importErrors.length || importing} onClick={stageImport}>{importing ? "Staging…" : "Send to review staging"}</button></div></>}
          </section>}
          <footer className="aq-footer">MockMaster Admin · Question content and answer keys are access-controlled.</footer>
        </section>
      </div>
    </main>
  );
}
