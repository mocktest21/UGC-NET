"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type StudentProfile = {
  full_name?: string;
  exams?: string[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("Student");
  const [exams, setExams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          router.replace("/login");
          return;
        }

        if (!active) return;
        const profile = data.user.user_metadata as StudentProfile;
        setName(profile.full_name || "Student");
        setExams(Array.isArray(profile.exams) ? profile.exams : []);
      } catch {
        router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => { active = false; };
  }, [router]);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return <main className="auth-page"><p>Loading your MockMaster account...</p></main>;
  }

  return (
    <main className="auth-page">
      <section className="auth-shell dashboard-shell">
        <div className="dashboard-account">
          <a className="brand" href="/"><span className="brand-mark">M</span>MockMaster</a>
          <button className="btn btn-outline" onClick={handleSignOut}>Log out</button>
        </div>
        <div className="dashboard-account-content">
          <span className="auth-kicker">STUDENT DASHBOARD</span>
          <h1>Welcome, {name}!</h1>
          <p>Your MockMaster account is connected. Your practice dashboard and test history will appear here as the next modules are built.</p>
          <h2>Your selected exams</h2>
          {exams.length ? (
            <div className="dashboard-exam-list">{exams.map((exam) => <span className="dashboard-exam-chip" key={exam}>{exam}</span>)}</div>
          ) : <p>No exam preferences saved yet.</p>}
          <a className="btn btn-primary" href="/#exams">Explore examinations →</a>
        </div>
      </section>
    </main>
  );
}
