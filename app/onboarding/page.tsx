"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type Subject = { id: string; name: string; code: string | null };
const targetAttempts = ["December 2026", "June 2027", "December 2027", "June 2028"];

export default function OnboardingPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [targetAttempt, setTargetAttempt] = useState("June 2027");
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
    setSaving(true);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { setError(userError?.message || "Please log in again."); setSaving(false); return; }
    const { data: exam, error: examError } = await supabase.from("exams").select("id").eq("code", "UGC_NET").maybeSingle();
    if (examError || !exam) { setError(examError?.message || "UGC NET exam setup was not found."); setSaving(false); return; }
    const { error: preferenceError } = await supabase.from("student_exam_preferences").upsert({
      student_id: user.id, exam_id: exam.id, selected_subject_id: subjectId,
    }, { onConflict: "student_id,exam_id" });
    if (preferenceError) { setError(preferenceError.message); setSaving(false); return; }
    const { error: metadataError } = await supabase.auth.updateUser({ data: {
      onboarding_completed: true,
      exam_preference: "UGC NET",
      paper2_subject_id: subjectId,
      target_attempt: targetAttempt,
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
        <p className="mm-onboarding-intro">Tell us a little about your UGC NET goal. You’ll need to complete this step before entering MockMaster.</p>
        <form onSubmit={handleSubmit}>
          <label className="mm-onboarding-label">Which exam are you preparing for?</label>
          <div className="mm-onboarding-fixed-choice"><span>✓</span> UGC NET</div>
          <label className="mm-onboarding-label" htmlFor="onboarding-subject">Your Paper 2 subject</label>
          <select id="onboarding-subject" value={subjectId} onChange={e => setSubjectId(e.target.value)} required>
            <option value="">Select your subject</option>
            {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}{subject.code ? ` (Code ${subject.code})` : ""}</option>)}
          </select>
          <label className="mm-onboarding-label" htmlFor="onboarding-attempt">Your target attempt</label>
          <select id="onboarding-attempt" value={targetAttempt} onChange={e => setTargetAttempt(e.target.value)} required>
            {targetAttempts.map(attempt => <option key={attempt} value={attempt}>{attempt}</option>)}
          </select>
          {error && <p className="mm-onboarding-error" role="alert">{error}</p>}
          <button className="mm-onboarding-submit" type="submit" disabled={saving || !subjects.length || !supabase}>{saving ? "Saving your details…" : "Save and continue →"}</button>
        </form>
        <small className="mm-onboarding-foot">You can update these details later from your profile.</small>
      </section>
    </main>
  );
}
