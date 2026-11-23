"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, Award, BookMarked, BookOpen, BrainCircuit,
  BriefcaseBusiness, ChartNoAxesCombined, ClipboardList, GraduationCap,
  Laptop, LogIn, Menu, NotebookPen, SearchCheck, ShieldCheck, Sparkles,
  Target, UserPlus, X
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import StudentWorkspaceHeader from "@/components/navigation/StudentWorkspaceHeader";
import "./about.css";

type AuthView = "loading" | "guest" | "student";

const units = [
  "Business Environment and International Business",
  "Accounting and Auditing",
  "Business Economics",
  "Business Finance",
  "Business Statistics and Research Methods",
  "Business Management and HRM",
  "Banking and Financial Institutions",
  "Marketing Management",
  "Legal Aspects of Business",
  "Income-tax and Corporate Tax Planning",
];

const features = [
  { icon: ClipboardList, title: "Mock tests & practice", detail: "Topic-wise, unit-wise, subject-wise and full-length practice, wherever available.", href: "/practice" },
  { icon: BookOpen, title: "Previous-year questions", detail: "Understand question patterns and strengthen exam-oriented preparation.", href: "/practice" },
  { icon: BrainCircuit, title: "Smart Quiz", detail: "Turn incorrect and bookmarked questions into focused revision practice.", href: "/practice" },
  { icon: NotebookPen, title: "Personal Notebook", detail: "Keep important questions together and revisit them when you need to.", href: "/personal-notebook" },
  { icon: ChartNoAxesCombined, title: "Performance insights", detail: "Review attempts, accuracy and areas that need more attention.", href: "/analytics" },
  { icon: SearchCheck, title: "Build your own practice", detail: "Create a focused practice session around the units you choose.", href: "/practice" },
];

export default function AboutPage() {
  const router = useRouter();
  const [authView, setAuthView] = useState<AuthView>("loading");
  const [studentName, setStudentName] = useState("");
  const [guestMenuOpen, setGuestMenuOpen] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [saved, setSaved] = useState([false, true]);
  const [secondsLeft, setSecondsLeft] = useState(50 * 60);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let alive = true;
    const syncUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      if (data.user) {
        setStudentName(data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "Student");
        setAuthView("student");
      } else {
        setStudentName("");
        setAuthView("guest");
      }
    };
    void syncUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session?.user) {
        setStudentName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Student");
        setAuthView("student");
      } else {
        setStudentName("");
        setAuthView("guest");
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setSecondsLeft((value) => value > 0 ? value - 1 : 50 * 60), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timerLabel = useMemo(() => {
    const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const ss = (secondsLeft % 60).toString().padStart(2, "0");
    return mm + ":" + ss;
  }, [secondsLeft]);

  const goTo = (path: string) => router.push(authView === "student" ? path : "/signup");
  const toggleUnit = (unit: string) => setSelectedUnits((current) => current.includes(unit) ? current.filter((item) => item !== unit) : [...current, unit]);

  return (
    <div className="mm-about-shell">
      {authView === "student" ? (
        <StudentWorkspaceHeader name={studentName} showNav />
      ) : (
        <header className="mm-about-nav">
          <div className="mm-about-nav-inner">
            <Link className="mm-about-brand" href="/"><span>M</span>Mock Buddy</Link>
            <nav className="mm-about-guest-links" aria-label="Public navigation">
              <Link href="/">Home</Link>
              <Link href="/about" aria-current="page">About</Link>
            </nav>
            <div className="mm-about-guest-actions">
              <Link className="mm-about-btn mm-about-btn-quiet" href="/login"><LogIn size={15}/>Log in</Link>
              <Link className="mm-about-btn mm-about-btn-primary" href="/signup"><UserPlus size={15}/>Sign up <ArrowRight size={15}/></Link>
            </div>
            <button className="mm-about-guest-toggle" type="button" aria-label={guestMenuOpen ? "Close menu" : "Open menu"} aria-expanded={guestMenuOpen} onClick={() => setGuestMenuOpen((v) => !v)}>{guestMenuOpen ? <X/> : <Menu/>}</button>
            {guestMenuOpen && <nav className="mm-about-guest-panel"><Link href="/" onClick={() => setGuestMenuOpen(false)}>Home</Link><Link href="/about" onClick={() => setGuestMenuOpen(false)}>About Mock Buddy</Link><Link href="/login" onClick={() => setGuestMenuOpen(false)}>Log in</Link><Link className="mm-about-panel-cta" href="/signup" onClick={() => setGuestMenuOpen(false)}>Create free account →</Link></nav>}
          </div>
        </header>
      )}

      <main className="mm-about-page">
        <section className="mm-about-hero" id="hero">
          <div className="mm-about-wrap">
            <span className="mm-about-pill"><i/>About Mock Buddy · UGC NET · Paper 1 &amp; Paper 2</span>
            <h1><span>Preparation deserves</span><span className="mm-about-gradient">clarity.</span></h1>
            <p>Mock Buddy is an online exam-preparation platform. Mock tests, previous-year questions, topic-based practice and revision tools, all in one place.</p>
            {authView === "student" ? (
              <div className="mm-about-actions"><Link className="mm-about-btn mm-about-btn-primary" href="/practice">Continue practising <ArrowRight size={16}/></Link><Link className="mm-about-btn" href="/analytics">View my analytics <Activity size={16}/></Link></div>
            ) : authView === "guest" ? (
              <div className="mm-about-actions"><Link className="mm-about-btn mm-about-btn-primary" href="/signup">Sign up <ArrowRight size={16}/></Link><Link className="mm-about-btn" href="/login">Log in to explore <LogIn size={16}/></Link></div>
            ) : <div className="mm-about-auth-placeholder">Loading your workspace…</div>}
          </div>
        </section>

        <section className="mm-about-note">
          <div className="mm-about-wrap">
            <div className="mm-about-tag">A note from us</div>
            <article className="mm-about-letter">
              <div className="mm-about-script">Hi, we're Manish &amp; Amrita.</div>
              <p>We're building Mock Buddy to make exam practice more structured and measurable. We're starting with <b>UGC NET Paper 1</b> and <b>Commerce Paper 2</b>.</p>
              <p>Amrita handles the academics. She has <b>qualified UGC-NET six times</b> and looks after question quality and exam strategy. Manish handles the technology and product.</p>
              <p>The question bank is still growing, unit by unit. If something is missing or wrong, tell us.</p>
              <div className="mm-about-sign">— Manish &amp; Amrita</div>
            </article>
          </div>
        </section>

        <section className="mm-about-founders">
          <div className="mm-about-wrap">
            <div className="mm-about-tag">The people behind Mock Buddy</div>
            <h2 className="mm-about-h2">Meet our <em>founders.</em></h2>
            <div className="mm-about-founder-grid">
              <article className="mm-about-admit">
                <div className="mm-about-admit-head"><span>ADMIT CARD</span><span>FOUNDER · 01</span></div>
                <div className="mm-about-admit-mid"><div className="mm-about-photo">MM</div><div><h3>Manish Mishra</h3><span className="mm-about-role">Co-Founder</span><dl><div><dt>Education</dt><dd>B.Com (Hons.), Hansraj College, University of Delhi</dd></div><div><dt>Currently</dt><dd>Pursuing M.Com (Commerce)</dd></div><div><dt>Background</dt><dd>Former Analyst</dd></div><div><dt>Focus</dt><dd>Technology, analytics and platform development</dd></div></dl></div></div>
                <p className="mm-about-bio">Brings together academic understanding and professional analytics experience. Leads the platform's technology, product development and user experience, with a focus on building a reliable and student-friendly preparation journey.</p>
                <div className="mm-about-admit-foot"><span>Manish Mishra<small>Signature</small></span><i/></div>
              </article>
              <article className="mm-about-admit mm-about-admit-amber">
                <div className="mm-about-admit-head"><span>ADMIT CARD</span><span>FOUNDER · 02</span></div>
                <div className="mm-about-admit-mid"><div className="mm-about-photo">AM</div><div><h3>Amrita Mishra</h3><span className="mm-about-role">Co-Founder</span><dl><div><dt>Achievement</dt><dd>Six-time UGC-NET qualified</dd></div><div><dt>Currently</dt><dd>Research Scholar, University of Lucknow</dd></div><div><dt>Background</dt><dd>Academic background in Commerce</dd></div><div><dt>Focus</dt><dd>Academic planning, question quality and exam strategy</dd></div></dl></div></div>
                <p className="mm-about-bio">Brings academic and research experience in Commerce and competitive-exam preparation. Guides Mock Buddy's academic direction, with an emphasis on question quality, exam patterns and student-centred learning.</p>
                <div className="mm-about-admit-foot"><span>Amrita Mishra<small>Signature</small></span><i/></div>
              </article>
            </div>
          </div>
        </section>

        <section className="mm-about-tools">
          <div className="mm-about-wrap">
            <div className="mm-about-tag">What's inside</div>
            <h2 className="mm-about-h2">Tools for practice <em>and revision.</em></h2>
            <div className="mm-about-bento">
              <article className="mm-about-tile mm-about-tile-large" onClick={() => goTo("/practice")} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") goTo("/practice"); }}>
                <div className="mm-about-mini"><div className="mm-about-timer"><span>PAPER 2 · MOCK PREVIEW</span><b>{timerLabel}</b></div><div className="mm-about-skeleton w85"/><div className="mm-about-skeleton w55"/>{["A","B","C","D"].map((v)=><div className="mm-about-option" key={v}><i>{v}</i><span className="mm-about-skeleton"/></div>)}</div><h3>Mock tests &amp; practice</h3><p>Topic-wise, unit-wise, subject-wise and full-length tests, wherever available.</p><span className="mm-about-tile-link">Open Practice <ArrowRight size={14}/></span>
              </article>
              <article className="mm-about-tile" onClick={() => goTo("/practice")} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") goTo("/practice"); }}><div className="mm-about-stack"><i/><i/><i/></div><h3>Previous-year questions</h3><p>Understand question patterns and practise exam-style questions.</p><span className="mm-about-tile-link">Explore practice <ArrowRight size={14}/></span></article>
              <article className="mm-about-tile" onClick={() => goTo("/practice")} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") goTo("/practice"); }}><div className="mm-about-checks"><span>✕ <i/></span><span>✓ <i/></span><span>✓ <i/></span></div><h3>Smart Quiz</h3><p>Turn incorrect answers into focused revision.</p><span className="mm-about-tile-link">Go to Practice <ArrowRight size={14}/></span></article>
              <article className="mm-about-tile"><div className="mm-about-notebook">{saved.map((value,index)=><button type="button" className={value ? "is-saved" : ""} key={index} onClick={() => setSaved((current) => current.map((item,i) => i === index ? !item : item))}><span>{value ? "★" : "☆"}</span><i/></button>)}</div><h3>Personal Notebook</h3><p>Tap the stars in this preview to see saved-question states.</p><button className="mm-about-tile-link mm-about-link-button" onClick={() => goTo("/personal-notebook")}>Open Notebook <ArrowRight size={14}/></button></article>
              <article className="mm-about-tile" onClick={() => goTo("/analytics")} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") goTo("/analytics"); }}><div className="mm-about-bars">{[35,52,44,68,60,86].map((height,i)=><i key={i} style={{height:height+"%"}}/>)}</div><h3>Performance insights</h3><p>Review attempts, accuracy and areas to improve.</p><span className="mm-about-tile-link">View Analytics <ArrowRight size={14}/></span></article>
              <article className="mm-about-tile mm-about-tile-wide">
                <div><div className="mm-about-tag">Build your own practice</div><h3>Choose units for your next practice session.</h3><p>Select any units below, then continue to the practice builder.</p></div>
                <div className="mm-about-unit-area"><div className="mm-about-chips">{units.map((unit) => <button type="button" className={selectedUnits.includes(unit) ? "is-selected" : ""} key={unit} onClick={() => toggleUnit(unit)}>{unit}</button>)}</div><div className="mm-about-build-row"><span><b>{selectedUnits.length}</b> units selected</span><button className="mm-about-btn mm-about-btn-primary" onClick={() => goTo("/practice")}>Start building <ArrowRight size={15}/></button></div></div>
              </article>
            </div>
          </div>
        </section>

        <section className="mm-about-close">
          <div className="mm-about-wrap"><div className="mm-about-close-box">
            <div><h2>Our vision: a trusted, accessible, <em>student-first</em> platform that helps you practise, assess your progress and move closer to your goals.</h2><p>Missing a feature or found a mistake? <Link href="/contact">Tell us directly <ArrowRight size={14}/></Link></p></div>
            {authView === "student" ? <Link className="mm-about-btn mm-about-btn-primary" href="/practice">Start practising <ArrowRight size={15}/></Link> : <Link className="mm-about-btn mm-about-btn-primary" href="/signup">Create your account <ArrowRight size={15}/></Link>}
          </div></div>
        </section>
      </main>
      <footer className="mm-about-footer"><span>© {new Date().getFullYear()} Mock Buddy · Built for aspirants, with clarity.</span><div><Link href="/">Home</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </div>
  );
}
