import type { Metadata } from "next";
import Link from "next/link";
import { Target, GraduationCap, BookOpen, BriefcaseBusiness, Award, Laptop, ArrowRight, ClipboardList, BrainCircuit, NotebookPen, ChartNoAxesCombined, SearchCheck, ShieldCheck } from "lucide-react";
import "./about.css";

export const metadata: Metadata = {
  title: "About Us | MockMaster",
  description: "Discover MockMaster, a student-first exam preparation platform, and meet the people building it.",
};

const platformFeatures = [
  { icon: ClipboardList, title: "Mock tests and practice", detail: "Practise through topic-wise, unit-wise, subject-wise and full-length test formats, wherever available." },
  { icon: BookOpen, title: "Previous-year questions", detail: "Use PYQs to understand question patterns and strengthen exam-oriented preparation." },
  { icon: BrainCircuit, title: "Smart Quiz", detail: "Turn incorrect and bookmarked questions into focused revision practice." },
  { icon: NotebookPen, title: "Personal Notebook", detail: "Keep important questions and saved items together for later revision." },
  { icon: ChartNoAxesCombined, title: "Performance insights", detail: "Review attempts, accuracy and areas that need more attention." },
  { icon: SearchCheck, title: "Build your own practice", detail: "Create a focused practice test by selecting the available subject and topics." },
];

const founders = [
  {
    name: "Manish Mishra",
    role: "Co-Founder",
    imageAlt: "Manish Mishra, Co-Founder of MockMaster",
    credentials: [
      { icon: GraduationCap, text: "B.Com (Hons.), Hansraj College, University of Delhi" },
      { icon: BookOpen, text: "Pursuing M.Com (Commerce)" },
      { icon: BriefcaseBusiness, text: "Former Analyst" },
      { icon: Laptop, text: "Focus: Technology, analytics and platform development" },
    ],
    bio: "Manish brings together academic understanding and professional analytics experience. He leads the platform’s technology, product development and user experience, with a focus on building a reliable and student-friendly preparation journey.",
  },
  {
    name: "Amrita Mishra",
    role: "Co-Founder",
    imageAlt: "Amrita Mishra, Co-Founder of MockMaster",
    credentials: [
      { icon: Award, text: "Six-time UGC-NET qualified" },
      { icon: GraduationCap, text: "Research Scholar, University of Lucknow" },
      { icon: BookOpen, text: "Academic background in Commerce" },
      { icon: Target, text: "Focus: Academic planning, question quality and exam strategy" },
    ],
    bio: "Amrita brings academic and research experience in Commerce and competitive-exam preparation. She guides MockMaster’s academic direction, with an emphasis on question quality, exam patterns and student-centred learning.",
  },
];

function SiteHeader() {
  return <header className="site-header"><div className="container nav">
    <Link className="brand" href="/"><span className="brand-mark">M</span>MockMaster</Link>
    <nav className="nav-links"><Link href="/">Home</Link><Link href="/exams">Exams</Link><Link href="/mock-tests">Mock Tests</Link><Link href="/pyq">PYQs</Link><Link href="/about" aria-current="page">About</Link></nav>
    <div className="nav-actions"><Link className="btn btn-outline desktop-login" href="/login">Log in</Link><Link className="btn btn-primary desktop-signup" href="/signup">Sign up <span>→</span></Link><details className="mobile-nav"><summary aria-label="Open navigation menu">☰ <span>Menu</span></summary><div className="mobile-nav-panel"><Link href="/exams">Examinations</Link><Link href="/mock-tests">Mock Tests</Link><Link href="/pyq">Previous-year questions</Link><Link href="/about">About</Link><Link href="/login">Log in</Link><Link className="mobile-nav-cta" href="/signup">Create free account →</Link></div></details></div>
  </div></header>;
}

function SiteFooter() {
  return <footer className="site-footer"><div className="container"><div className="footer-grid">
    <div className="footer-brand"><Link className="brand" href="/" style={{color:"white"}}><span className="brand-mark">M</span>MockMaster</Link><p>A student-first platform for mock tests, previous-year questions and focused competitive-exam practice.</p></div>
    <div className="footer-col"><h4>Explore</h4><Link href="/exams">All examinations</Link><Link href="/mock-tests">Mock tests</Link><Link href="/pyq">Previous-year questions</Link><Link href="/about">About MockMaster</Link></div>
    <div className="footer-col"><h4>Examinations</h4><Link href="/exams/ugc-net">UGC NET</Link><Link href="/exams/ssc">SSC</Link><Link href="/exams/upsc">UPSC</Link><Link href="/exams/banking">Banking</Link><Link href="/exams/railways">Railways</Link></div>
    <div className="footer-col"><h4>Information</h4><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms &amp; conditions</Link><Link href="/contact">Contact</Link></div>
  </div><div className="footer-bottom"><span>© {new Date().getFullYear()} MockMaster. All rights reserved.</span><span>Practice. Improve. Achieve.</span></div></div></footer>;
}

export default function About() {
  return <>
    <SiteHeader />
    <main className="about-page">
      <section className="about-hero">
        <div className="about-crumb"><Link href="/">Home</Link><span>/</span>About</div>
        <span className="about-kicker">ABOUT MOCKMASTER</span>
        <h1>Preparation deserves <span>clarity.</span></h1>
        <p>MockMaster is an online exam-preparation and practice platform designed to help aspirants prepare in a more structured, focused and measurable way. It brings mock tests, previous-year questions, topic-based practice and revision tools together in one place.</p>
      </section>

      <section className="about-intro">
        <div className="about-intro-mark"><span className="brand-mark">M</span></div>
        <div><span className="about-kicker">WHAT IS MOCKMASTER?</span><h2>A practice companion for your competitive-exam journey.</h2>
          <p>Starting with UGC NET, MockMaster is being developed to support learners with Paper 1 and subject-specific Paper 2 preparation, including Commerce and Management. The platform is designed to make it easier to practise, revisit challenging questions, understand performance and plan the next step in preparation.</p>
          <p>Our broader vision is to extend this organised learning experience to more competitive examinations while keeping the experience accessible and student-focused.</p>
        </div>
      </section>

      <section className="platform-section">
        <div className="about-section-heading"><span className="about-kicker">THE PLATFORM</span><h2>What can you do on MockMaster?</h2><p>Tools designed to support practice, revision and progress.</p></div>
        <div className="platform-feature-grid">{platformFeatures.map(({icon:Icon,title,detail})=><article className="platform-feature" key={title}><div className="platform-feature-icon"><Icon size={22}/></div><h3>{title}</h3><p>{detail}</p></article>)}</div>
      </section>

      <section className="about-values">
        <div><ShieldCheck size={27}/><h3>Student-first approach</h3><p>Clear navigation and practical tools built around learners’ preparation needs.</p></div>
        <div><Target size={27}/><h3>Focused preparation</h3><p>Organised practice and revision to help learners use their study time meaningfully.</p></div>
        <div><BookOpen size={27}/><h3>Continuous improvement</h3><p>A platform that will keep evolving with learner feedback and exam requirements.</p></div>
      </section>

      <section className="founders-section">
        <div className="about-section-heading"><span className="about-kicker">THE PEOPLE BEHIND MOCKMASTER</span><h2>Meet our founders</h2><p>The people bringing the academic and technology sides of MockMaster together.</p></div>
        <div className="founder-grid" aria-label="MockMaster founders">
          {founders.map((founder) => (
            <article className="founder-card" key={founder.name}>
              <div className="founder-photo"><div className="founder-photo-fallback" role="img" aria-label={founder.imageAlt}>{founder.name.split(" ").map((part) => part[0]).join("")}</div></div>
              <div className="founder-info">
                <h2>{founder.name}</h2><span className="founder-role">{founder.role}</span>
                <ul className="founder-credentials">{founder.credentials.map(({icon:Icon,text})=><li key={text}><Icon size={19} strokeWidth={1.8}/><span>{text}</span></li>)}</ul>
                <p className="founder-bio">{founder.bio}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-vision"><div className="vision-heading"><Target size={34}/><h2>Our Shared Vision</h2></div><p>To build a trusted, accessible and student-first preparation platform that empowers aspirants to practise, assess their progress and move closer to their goals.</p></section>
      <section className="about-bottom"><div><span className="about-kicker">YOUR PREPARATION. YOUR PROGRESS.</span><h2>Make your next practice session count.</h2><p>Explore examinations, mock tests and previous-year questions on MockMaster.</p></div><Link href="/exams" className="about-cta">Explore examinations <ArrowRight size={17}/></Link></section>
    </main>
    <SiteFooter />
  </>;
}
