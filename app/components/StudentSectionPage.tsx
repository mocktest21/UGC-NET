"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Section = "practice" | "live-test" | "personal-notebook";
const links = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Practice", href: "/practice" },
  { label: "Live Test", href: "/live-test" },
  { label: "Personal Notebook", href: "/personal-notebook" },
  { label: "About Us", href: "/About" },
];
const content = {
  practice: {
    title: "Practice centre",
    subtitle: "Choose your examination and build confidence with focused practice.",
  },
  "live-test": {
    title: "Live tests",
    subtitle: "Find your scheduled mock tests and attempt them within the test window.",
  },
  "personal-notebook": {
    title: "Personal notebook",
    subtitle: "Keep your important learning points and revision notes in one place.",
  },
};

export default function StudentSectionPage({ section }: { section: Section }) {
  const router = useRouter();
  const [name, setName] = useState("Student");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          router.replace("/login");
          return;
        }
        if (active) {
          const fullName = (data.user.user_metadata?.full_name as string) || "Student";
          const first = fullName.trim().split(/\s+/)[0] || "Student";
          setName(first.charAt(0).toUpperCase() + first.slice(1).toLowerCase());
        }
      } catch {
        router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  if (loading) return <main className="mm-loading"><span className="mm-loading-mark">M</span><p>Loading your MockMaster workspace...</p></main>;

  const page = content[section];
  return (
    <main className="mm-workspace-page">
      <header className="mm-workspace-header">
        <a className="mm-brand" href="/"><span className="mm-brand-mark">M</span><span>MockMaster</span></a>
        <nav aria-label="Main navigation" className="mm-workspace-nav">
          {links.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={link.href === "/" + section ? "active" : ""}>{link.label}</a>
          ))}
        </nav>
        <span className="mm-workspace-user">Hey, {name}!</span>
      </header>

      <section className="mm-workspace-content">
        <div className="mm-workspace-intro"><span>MOCKMASTER WORKSPACE</span><h1>{page.title}</h1><p>{page.subtitle}</p></div>
        {section === "practice" && (
          <div className="mm-workspace-cards">
            <article><span>📘</span><small>COMMON PAPER</small><h2>UGC NET Paper 1</h2><p>Teaching and Research Aptitude</p><div>Practice material <b>→</b></div></article>
            <article><span>📊</span><small>PAPER 2 · SUBJECT CODE 08</small><h2>Commerce</h2><p>Subject-wise and unit-wise preparation</p><div>Practice material <b>→</b></div></article>
            <article><span>💼</span><small>PAPER 2 · SUBJECT CODE 17</small><h2>Management</h2><p>Subject-wise and unit-wise preparation</p><div>Practice material <b>→</b></div></article>
          </div>
        )}
        {section === "live-test" && <div className="mm-workspace-empty"><span>◷</span><h2>No live test is scheduled right now</h2><p>Your upcoming and active tests will be listed here.</p></div>}
        {section === "personal-notebook" && <div className="mm-workspace-empty"><span>✎</span><h2>Your notebook is ready</h2><p>Saved notes and bookmarked questions will appear here.</p></div>}
      </section>
      <footer className="mm-workspace-footer">© {new Date().getFullYear()} MockMaster <span>Practice. Improve. Achieve.</span></footer>
    </main>
  );
}
