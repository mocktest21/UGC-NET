"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type StudentProfile = {
  full_name?: string;
  exams?: string[];
  phone_number?: string | null;
};

type Student = {
  name: string;
  email: string;
  exams: string[];
  phone?: string | null;
};

const navigation = [
  { label: "Overview", icon: "⌂", href: "#overview" },
  { label: "My examinations", icon: "▤", href: "#examinations" },
  { label: "Practice centre", icon: "◎", href: "#practice" },
  { label: "Test history", icon: "◷", href: "#history" },
  { label: "Performance", icon: "↗", href: "#performance" },
];

const practiceOptions = [
  { title: "UGC NET Paper 1", detail: "Teaching & Research Aptitude", tag: "Common paper", icon: "📘" },
  { title: "Commerce", detail: "UGC NET Paper 2 · Subject code 08", tag: "Paper 2", icon: "📊" },
  { title: "Management", detail: "UGC NET Paper 2 · Subject code 17", tag: "Paper 2", icon: "💼" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadStudent() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          router.replace("/login");
          return;
        }

        if (!active) return;
        const profile = data.user.user_metadata as StudentProfile;
        setStudent({
          name: profile.full_name || "Student",
          email: data.user.email || "",
          exams: Array.isArray(profile.exams) ? profile.exams : [],
          phone: profile.phone_number,
        });
      } catch {
        router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStudent();
    return () => { active = false; };
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading || !student) {
    return (
      <main className="mm-loading">
        <span className="mm-loading-mark">M</span>
        <p>Loading your MockMaster dashboard...</p>
      </main>
    );
  }

  const initials = student.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className="mm-dashboard">
      <aside className={menuOpen ? "mm-sidebar mm-sidebar-open" : "mm-sidebar"}>
        <a className="mm-brand" href="/"><span className="mm-brand-mark">M</span><span>MockMaster</span></a>
        <div className="mm-side-label">STUDENT WORKSPACE</div>
        <nav className="mm-side-nav" aria-label="Student navigation">
          {navigation.map((item, index) => (
            <a key={item.label} className={index === 0 ? "mm-nav-link mm-nav-active" : "mm-nav-link"} href={item.href} onClick={() => setMenuOpen(false)}>
              <span className="mm-nav-icon">{item.icon}</span>{item.label}
            </a>
          ))}
        </nav>
        <div className="mm-sidebar-bottom">
          <div className="mm-help-card">
            <span className="mm-help-icon">✦</span>
            <strong>Keep your momentum</strong>
            <p>Small, consistent practice sessions build stronger preparation.</p>
          </div>
          <button className="mm-logout" onClick={handleSignOut} disabled={signingOut}>
            <span>↪</span>{signingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      </aside>

      {menuOpen && <button className="mm-sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <div className="mm-main">
        <header className="mm-topbar">
          <button className="mm-menu-toggle" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>☰</button>
          <div className="mm-topbar-right">
            <div className="mm-profile-pill" aria-label={`Signed in as ${student.name}`}><span className="mm-avatar">{initials || "S"}</span><span>{student.name.split(" ")[0]}</span></div>
          </div>
        </header>

        <main className="mm-content" id="overview">
          <section className="mm-welcome">
            <div>
              <div className="mm-welcome-title-row"><h1>Hello, {student.name.split(" ")[0]}</h1><span className="mm-new-here">✳ New here</span></div>
              <p>Your preparation starts here. Choose an exam and build your practice routine.</p>
              <a className="mm-new-test" href="#practice">New test <span>→</span></a>
            </div>
            <div className="mm-welcome-art" aria-hidden="true">
              <div className="mm-art-sheet"><span>✓</span><i /><i /><i /></div>
              <div className="mm-art-star">✦</div>
            </div>
          </section>

          <section className="mm-stat-grid" aria-label="Your statistics">
            <article className="mm-stat-card"><span className="mm-stat-icon mm-stat-blue">▤</span><div><strong>0</strong><span>Tests attempted</span></div><small>Start your first test</small></article>
            <article className="mm-stat-card"><span className="mm-stat-icon mm-stat-green">↗</span><div><strong>—</strong><span>Average score</span></div><small>Appears after your tests</small></article>
            <article className="mm-stat-card"><span className="mm-stat-icon mm-stat-orange">◎</span><div><strong>—</strong><span>Accuracy</span></div><small>Build your performance data</small></article>
            <article className="mm-stat-card"><span className="mm-stat-icon mm-stat-purple">♧</span><div><strong>0 days</strong><span>Practice streak</span></div><small>Your journey starts today</small></article>
          </section>

          <section className="mm-section" id="examinations">
            <div className="mm-section-heading">
              <div><span className="mm-section-kicker">YOUR GOALS</span><h2>My examinations</h2><p>Exams selected in your account profile.</p></div>
              <span className="mm-count-pill">{student.exams.length} selected</span>
            </div>
            {student.exams.length ? (
              <div className="mm-exam-chips">{student.exams.map((exam) => <span className="mm-exam-chip" key={exam}><i>✓</i>{exam}</span>)}</div>
            ) : (
              <div className="mm-empty-inline">No exam preferences saved yet. You can update them in your profile.</div>
            )}
          </section>

          <section className="mm-section" id="practice">
            <div className="mm-section-heading">
              <div><span className="mm-section-kicker">READY WHEN YOU ARE</span><h2>Choose your practice area</h2><p>Your UGC NET practice categories will be organised here.</p></div>
              <span className="mm-coming-pill">Test library coming next</span>
            </div>
            <div className="mm-practice-grid">
              {practiceOptions.map((option) => (
                <article className="mm-practice-card" key={option.title}>
                  <div className="mm-practice-card-top"><span className="mm-practice-icon">{option.icon}</span><span className="mm-practice-tag">{option.tag}</span></div>
                  <h3>{option.title}</h3><p>{option.detail}</p>
                  <div className="mm-practice-card-foot"><span>Question sets will appear here</span><span className="mm-arrow">→</span></div>
                </article>
              ))}
            </div>
          </section>

          <section className="mm-lower-grid">
            <article className="mm-panel" id="history">
              <div className="mm-panel-heading"><div><span className="mm-section-kicker">YOUR ACTIVITY</span><h2>Recent test attempts</h2></div><span className="mm-muted-label">Test history</span></div>
              <div className="mm-empty-state"><span className="mm-empty-icon">◷</span><strong>No attempts yet</strong><p>Your completed tests and scores will be listed here.</p></div>
            </article>
            <article className="mm-panel" id="performance">
              <div className="mm-panel-heading"><div><span className="mm-section-kicker">TRACK YOUR GROWTH</span><h2>Performance overview</h2></div></div>
              <div className="mm-empty-state"><span className="mm-empty-icon">↗</span><strong>Your analytics are waiting</strong><p>Attempt practice tests to unlock score trends and topic-wise insights.</p></div>
            </article>
          </section>

          <footer className="mm-footer"><span>© {new Date().getFullYear()} MockMaster</span><span>Practice. Improve. Achieve.</span></footer>
        </main>
      </div>

      <nav className="mm-bottom-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 4).map((item, index) => (
          <a key={item.label} className={index === 0 ? "mm-bottom-link mm-bottom-active" : "mm-bottom-link"} href={item.href}>
            <span>{item.icon}</span><small>{index === 0 ? "Home" : index === 1 ? "Exams" : index === 2 ? "Practice" : "History"}</small>
          </a>
        ))}
      </nav>
    </div>
  );
}
