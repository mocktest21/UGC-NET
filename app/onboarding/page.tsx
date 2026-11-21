"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type Subject = { id: string; name: string; code: string | null };
const targetAttempts = ["December 2026", "June 2027", "December 2027", "June 2028"];
const categories = ["General", "EWS", "OBC-NCL", "SC", "ST"];
const qualificationGoals = ["Assistant Professor", "JRF", "Both"];

export default function OnboardingPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [targetAttempt, setTargetAttempt] = useState("June 2027");
  const [category, setCategory] = useState("");
  const [isPwd, setIsPwd] = useState(false);
  const [qualificationGoal, setQualificationGoal] = useState("Both");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const client = createSupabaseBrowserClient();
        if (!active) return;
        setSupabase(client);
        const { data: { user } } = await client.auth.getUser();
        if (!active) return;
        if (!user) { router.replace("/login"); return; }
        if (user.user_metadata?.onboarding_completed === true) { router.replace("/dashboard"); return; }

        const { data: exam, error: examError } = await client.from("exams").select("id").eq("code", "UGC_NET").maybeSingle();
        if (examError || !exam) { setError(examError?.message || "UGC NET exam setup was not found."); setLoading(false); return; }
        const { data: paper, error: paperError } = await client.from("papers").select("id").eq("exam_id", exam.id).or("code.ilike.%2%,name.ilike.%Paper 2%").eq("is_active", true).maybeSingle();
        if (paperError || !paper) { setError(paperError?.message || "UGC NET Paper 2 setup was not found."); setLoading(false); return; }
        const { data: subjectRows, error: subjectError } = await client.from("subjects").select("id,name,code").eq("paper_id", paper.id).eq("is_active", true).order("display_order");
        if (!active) return;
        if (subjectError) setError(subjectError.message);
        const list = (subjectRows || []) as Subject[];
        setSubjects(list);
        const savedSubject = user.user_metadata?.paper2_subject_id;
        setSubjectId(list.some(s => s.id === savedSubject) ? savedSubject : list[0]?.id || "");
        setCategory(typeof user.user_metadata?.category === "string" ? user.user_metadata.category : "");
        setIsPwd(user.user_metadata?.is_pwd === true);
        setQualificationGoal(typeof user.user_metadata?.qualification_goal === "string" ? user.user_metadata.qualification_goal : "Both");
        setLoading(false);
      } catch (e) {
        if (active) { setError(e instanceof Error ? e.message : "Unable to initialise your profile."); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!supabase) { setError("Supabase is not available. Please refresh and try again."); return; }
    if (!subjectId) { setError("Please select your Paper 2 subject."); return; }
    if (!category) { setError("Please select your category."); return; }
    if (!qualificationGoal) { setError("Please select your qualification target."); return; }
    setSaving(true);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { setError(userError?.message || "Please log in again."); setSaving(false); return; }
    const { data: exam, error: examError } = await supabase.from("exams").select("id").eq("code", "UGC_NET").maybeSingle();
    if (examError || !exam) { setError(examError?.message || "UGC NET exam setup was not found."); setSaving(false); return; }
    const { error: preferenceError } = await supabase.from("student_exam_preferences").upsert({
      student_id: user.id,
      exam_id: exam.id,
      selected_subject_id: subjectId,
      category,
      is_pwd: isPwd,
      qualification_goal: qualificationGoal,
      target_exam_cycle: targetAttempt,
    }, { onConflict: "student_id,exam_id" });
    if (preferenceError) { setError(preferenceError.message); setSaving(false); return; }
    const { error: metadataError } = await supabase.auth.updateUser({ data: {
      onboarding_completed: true,
      exam_preference: "UGC NET",
      paper2_subject_id: subjectId,
      target_attempt: targetAttempt,
      category,
      is_pwd: isPwd,
      qualification_goal: qualificationGoal,
    }});
    if (metadataError) { setError(metadataError.message); setSaving(false); return; }
    router.replace("/dashboard");
    router.refresh();
  }

  if (loading) return <main className="mm-onboarding-page"><div className="mm-onboarding-card">Preparing your profile…</div></main>;

  return (
    <main className="mm-onboarding-page">
      <section className="mm-onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className="mm-onboarding-mark">M</div>
        <span className="mm-onboarding-kicker">ONE-TIME PROFILE SETUP</span>
        <h1 id="onboarding-title">Let’s personalise your preparation</h1>
        <p className="mm-onboarding-intro">Share a few details to personalise your UGC NET preparation and estimate readiness against the right qualification benchmark.</p>
        <form onSubmit={handleSubmit}>
          <label className="mm-onboarding-label">Which exam are you preparing for?</label>
          <div className="mm-onboarding-fixed-choice"><span>✓</span> UGC NET</div>

          <label className="mm-onboarding-label" htmlFor="onboarding-subject">Your Paper 2 subject</label>
          <select id="onboarding-subject" value={subjectId} onChange={e => setSubjectId(e.target.value)} required>
            <option value="">Select your subject</option>
            {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}{subject.code ? ` (Code ${subject.code})` : ""}</option>)}
          </select>

          <label className="mm-onboarding-label" htmlFor="onboarding-category">Your category</label>
          <select id="onboarding-category" value={category} onChange={e => setCategory(e.target.value)} required>
            <option value="">Select your category</option>
            {categories.map(value => <option key={value} value={value}>{value}</option>)}
          </select>

          <label className="mm-onboarding-label" htmlFor="onboarding-pwd">Do you belong to the PwBD category?</label>
          <select id="onboarding-pwd" value={isPwd ? "yes" : "no"} onChange={e => setIsPwd(e.target.value === "yes")} required>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>

          <label className="mm-onboarding-label" htmlFor="onboarding-goal">Your qualification target</label>
          <select id="onboarding-goal" value={qualificationGoal} onChange={e => setQualificationGoal(e.target.value)} required>
            {qualificationGoals.map(value => <option key={value} value={value}>{value}</option>)}
          </select>

          <label className="mm-onboarding-label" htmlFor="onboarding-attempt">Your target attempt</label>
          <select id="onboarding-attempt" value={targetAttempt} onChange={e => setTargetAttempt(e.target.value)} required>
            {targetAttempts.map(attempt => <option key={attempt} value={attempt}>{attempt}</option>)}
          </select>

          {error && <p className="mm-onboarding-error" role="alert">{error}</p>}
          <button className="mm-onboarding-submit" type="submit" disabled={saving || !subjects.length || !supabase}>{saving ? "Saving your details…" : "Save and continue →"}</button>
        </form>
        <small className="mm-onboarding-foot">These details help us choose relevant historical cutoffs. You can update them later from your profile.</small>
      </section>
    </main>
  );
}
