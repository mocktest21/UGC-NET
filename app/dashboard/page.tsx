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
  { label: "Performance", icon: "↗", href: "#performance" },
];

const desktopNavigation = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Practice", href: "/practice" },
  { label: "Live Test", href: "/live-test" },
  { label: "Personal Notebook", href: "/personal-notebook" },
  { label: "About Us", href: "/About" },
];

const practiceOptions = [
  { title: "UGC NET Paper 1", detail: "Teaching & Research Aptitude", tag: "Common paper", icon: "📘" },
  { title: "Commerce", detail: "UGC NET Paper 2 · Subject code 08", tag: "Paper 2", icon: "📊" },
  { title: "Management", detail: "UGC NET Paper 2 · Subject code 17", tag: "Paper 2", icon: "💼" },
];

const summaryStats = [
  { label: "Tests attempted", icon: "▤", note: "Completed tests" },
  { label: "Average score", icon: "↗", note: "Across completed tests" },
  { label: "Accuracy", icon: "◎", note: "Correct answers ÷ attempted" },
  { label: "Units mastered", icon: "✓", note: "Based on unit performance" },
  { label: "Total questions", icon: "▦", note: "In your selected question banks" },
  { label: "Unique questions attempted", icon: "◉", note: "Distinct questions attempted at least once" },
  { label: "Relative standing", icon: "🏆", note: "Your percentile among comparable students" },
];

function EmptyAnalytics({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mm-analytics-empty">
      <span className="mm-empty-icon">▤</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

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
  const firstNameRaw = student.name.trim().split(/\s+/)[0] || "Student";
  const firstName = firstNameRaw.charAt(0).toUpperCase() + firstNameRaw.slice(1).toLowerCase();

  return (
    <div className="mm-dashboard">
      <aside className={menuOpen ? "mm-sidebar mm-sidebar-open" : "mm-sidebar"}>
        <a className="mm-brand" href="/"><span className="mm-brand-mark">M</span><span>MockMaster</span></a>
        <div className="mm-side-label">STUDENT WORKSPACE</div>
        <nav className="mm-side-nav" aria-label="Student navigation">
          {navigation.map((item, index) => (
            <a key={item.label} className={index === 0 ? "mm-nav-link mm-nav-active" : "mm-nav-link"} href={item.label === "Practice centre" ? "/practice" : item.label === "My examinations" ? "/dashboard#examinations" : item.label === "Performance" ? "/dashboard#performance" : "/dashboard"} onClick={() => setMenuOpen(false)}>
              <span className="mm-nav-icon">{item.icon}</span>{item.label}
            </a>
          ))}
        </nav>
        <nav className="mm-desktop-nav" aria-label="Main navigation">
          {desktopNavigation.map((item, index) => (
            <a key={item.label} className={index === 0 ? "mm-nav-link mm-nav-active" : "mm-nav-link"} href={item.href}>{item.label}</a>
          ))}
        </nav>
        <div className="mm-sidebar-profile">
          <span className="mm-avatar">{initials || "S"}</span>
          <span>{firstName}</span>
        </div>
        <div className="mm-sidebar-bottom">
          <div className="mm-help-card">
            <span className="mm-help-icon">✦</span>
            <strong>Keep your momentum</strong>
            <p>Consistent practice builds measurable progress.</p>
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
          <div className="mm-mobile-page-label">Performance dashboard</div>
          <div className="mm-topbar-right">
            <div className="mm-profile-pill" aria-label={`Signed in as ${student.name}`}><span className="mm-avatar">{initials || "S"}</span><span>{firstName}</span></div>
          </div>
        </header>

        <main className="mm-content mm-analytics-content" id="overview">
          <section className="mm-analytics-heading">
            <div>
              <h1>Hey, {firstName}!</h1>
              <p>Let’s analyse your progress and see where you can improve.</p>
            </div>
          </section>

          <section className="mm-analytics-summary" aria-label="Overall performance statistics">
            {summaryStats.map((stat) => (
              <article className="mm-analytics-stat" key={stat.label}>
                <span className="mm-analytics-stat-icon">{stat.icon}</span>
                <div className="mm-analytics-stat-copy">
                  <span>{stat.label}</span>
                  <strong>—</strong>
                  <small>{stat.note}</small>
                </div>
              </article>
            ))}
          </section>

          <section className="mm-analytics-panel mm-overall-panel" id="performance">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">PROGRESS TRACKER</span><h2>Performance trends</h2><p>Your scores and accuracy will be plotted as you complete tests.</p></div>
              <span className="mm-analytics-filter">All time</span>
            </div>
            <EmptyAnalytics title="Your performance trend will appear here" detail="Complete your first mock test to start tracking score and accuracy trends over time." />
          </section>

          <section className="mm-analytics-panel" id="examinations">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">EXAM-WISE OVERVIEW</span><h2>My examinations</h2><p>Performance will be organised separately for each examination you have selected.</p></div>
              <span className="mm-count-pill">{student.exams.length} selected</span>
            </div>
            {student.exams.length ? (
              <div className="mm-analytics-exam-grid">
                {student.exams.map((exam) => (
                  <article className="mm-analytics-exam-card" key={exam}>
                    <div className="mm-analytics-exam-top"><span className="mm-analytics-exam-icon">▤</span><span className="mm-analytics-status">Selected</span></div>
                    <h3>{exam}</h3>
                    <div className="mm-analytics-exam-metrics">
                      <div><strong>—</strong><span>Tests</span></div>
                      <div><strong>—</strong><span>Average score</span></div>
                      <div><strong>—</strong><span>Accuracy</span></div>
                    </div>
                    <p>Statistics will populate after test attempts are recorded.</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyAnalytics title="No examinations selected" detail="Your selected examinations will appear here after you update your profile." />
            )}
          </section>

          <section className="mm-analytics-two-col">
            <article className="mm-analytics-panel">
              <div className="mm-analytics-panel-heading">
                <div><span className="mm-section-kicker">PAPER-WISE ANALYSIS</span><h2>Performance by paper</h2><p>Compare scores and accuracy across papers.</p></div>
              </div>
              <EmptyAnalytics title="Paper-wise statistics are not available yet" detail="Your paper-level results will appear here after you attempt tests." />
            </article>
            <article className="mm-analytics-panel">
              <div className="mm-analytics-panel-heading">
                <div><span className="mm-section-kicker">SUBJECT-WISE ANALYSIS</span><h2>Subject performance</h2><p>See how you are performing in each subject.</p></div>
              </div>
              <EmptyAnalytics title="Subject analysis will appear here" detail="Attempt subject tests to build your subject-wise performance record." />
            </article>
          </section>

          <section className="mm-analytics-panel mm-unit-panel" id="unit-analysis">
            <div className="mm-analytics-panel-heading">
              <div><span className="mm-section-kicker">DETAILED SYLLABUS ANALYSIS</span><h2>Unit-wise performance</h2><p>Identify strong units, weak units and your progress across the syllabus.</p></div>
              <span className="mm-unit-badge">Core analytics</span>
            </div>
            <div className="mm-unit-empty">
              <div className="mm-unit-empty-art">▤</div>
              <div><strong>Your unit-wise report will build here</strong><p>For every unit, MockMaster will track questions attempted, correct and incorrect answers, accuracy, average score, test coverage and improvement.</p></div>
            </div>
            <div className="mm-unit-metric-list">
              <span>Unit accuracy</span><span>Questions attempted</span><span>Correct / incorrect</span><span>Mastery level</span><span>Progress over time</span>
            </div>
          </section>

          <section className="mm-analytics-two-col">
            <article className="mm-analytics-panel">
              <div className="mm-analytics-panel-heading">
                <div><span className="mm-section-kicker">WHAT YOU DO WELL</span><h2>Strengths & weaknesses</h2><p>See which papers, subjects and units need attention.</p></div>
              </div>
              <EmptyAnalytics title="Your strengths are waiting to be identified" detail="MockMaster will highlight your strongest and weakest areas using your actual test results." />
            </article>
            <article className="mm-analytics-panel">
              <div className="mm-analytics-panel-heading">
                <div><span className="mm-section-kicker">NEXT STEPS</span><h2>Revision recommendations</h2><p>Focused suggestions based on your performance.</p></div>
              </div>
              <EmptyAnalytics title="Personalised recommendations will appear here" detail="Once enough test data is available, revision priorities will be based on your weaker units and performance gaps." />
            </article>
          </section>

          <footer className="mm-footer"><span>© {new Date().getFullYear()} MockMaster</span><span>Practice. Improve. Achieve.</span></footer>
        </main>
      </div>

      <nav className="mm-bottom-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 4).map((item, index) => (
          <a key={item.label} className={index === 0 ? "mm-bottom-link mm-bottom-active" : "mm-bottom-link"} href={item.label === "Practice centre" ? "/practice" : item.label === "My examinations" ? "/dashboard#examinations" : item.label === "Performance" ? "/dashboard#performance" : "/dashboard"}>
            <span>{item.icon}</span><small>{index === 0 ? "Home" : index === 1 ? "Exams" : index === 2 ? "Practice" : "Progress"}</small>
          </a>
        ))}
      </nav>
    </div>
  );
}
