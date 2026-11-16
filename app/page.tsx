import { BookOpen, Target, Landmark, Building2, TrainFront, Compass, ChartNoAxesColumnIncreasing, ClipboardList, Search, Smartphone, GraduationCap } from "lucide-react";
import Link from "next/link";
const exams = [
  { icon: <BookOpen size={21} strokeWidth={1.8} />, name: "UGC NET", desc: "Paper 1 and subject-wise Paper 2 practice", href: "/exams/ugc-net" },
  { icon: <Target size={21} strokeWidth={1.8} />, name: "SSC", desc: "Prepare for SSC competitive examinations", href: "/exams/ssc" },
  { icon: <Landmark size={21} strokeWidth={1.8} />, name: "UPSC", desc: "Build a consistent civil services practice routine", href: "/exams/upsc" },
  { icon: <Building2 size={21} strokeWidth={1.8} />, name: "Banking", desc: "Practice banking and aptitude questions", href: "/exams/banking" },
  { icon: <TrainFront size={21} strokeWidth={1.8} />, name: "Railways", desc: "Explore railway recruitment exam practice", href: "/exams/railways" },
];
const tests = [
  { exam: "UGC NET", type: "Paper 1", name: "Teaching & Research Aptitude", detail: "A focused practice set covering core Paper 1 areas.", questions: "50 questions", duration: "60 min" },
  { exam: "UGC NET", type: "Commerce", name: "Commerce – Mixed Practice", detail: "A subject-wise practice set for Commerce aspirants.", questions: "50 questions", duration: "60 min" },
  { exam: "UGC NET", type: "Management", name: "Management – Mixed Practice", detail: "Review key Management concepts through MCQs.", questions: "50 questions", duration: "60 min" },
];
const features = [
  [<Compass size={21} strokeWidth={1.8} />, "Structured preparation", "Find examinations, subjects, topics and practice sets in a clear hierarchy."],
  [<ChartNoAxesColumnIncreasing size={21} strokeWidth={1.8} />, "Meaningful progress", "A focused practice experience designed to help you identify what to revise next."],
  [<ClipboardList size={21} strokeWidth={1.8} />, "Previous-year questions", "Browse papers by examination, subject and year, all in one organised place."],
  [<Search size={21} strokeWidth={1.8} />, "Quick discovery", "Search across examinations, subjects, topics, mock tests and PYQs."],
  [<Smartphone size={21} strokeWidth={1.8} />, "Designed for every screen", "A responsive experience for desktop, tablet and mobile."],
  [<GraduationCap size={21} strokeWidth={1.8} />, "A focused learning space", "A clean, distraction-free environment built around exam preparation."],
];
export default function Home() {
  return <>
    <header className="site-header"><div className="container nav">
      <Link className="brand" href="/"><span className="brand-mark">M</span>MockMaster</Link>
      <nav className="nav-links"><Link href="/">Home</Link><Link href="/exams">Exams</Link><Link href="/mock-tests">Mock Tests</Link><Link href="/pyq">PYQs</Link><Link href="/about">About</Link></nav>
      <div className="nav-actions"><Link className="btn btn-outline desktop-login" href="/login">Log in</Link><Link className="btn btn-primary desktop-signup" href="/signup">Sign up <span>→</span></Link><details className="mobile-nav"><summary aria-label="Open navigation menu">☰ <span>Menu</span></summary><div className="mobile-nav-panel"><Link href="/exams">Examinations</Link><Link href="/mock-tests">Mock Tests</Link><Link href="/pyq">Previous-year questions</Link><Link href="/about">About</Link><Link href="/login">Log in</Link><Link className="mobile-nav-cta" href="/signup">Create free account →</Link></div></details></div>
    </div></header>
    <main>
      <section className="hero"><div className="container hero-grid">
        <div><span className="eyebrow"><i className="eyebrow-dot"/> A smarter way to practise</span>
          <h1>Practice.<br/><span>Improve.</span> Achieve.</h1>
          <p className="hero-copy">Prepare with purpose. Explore mock tests and previous-year questions across competitive examinations, and make every practice session count.</p>
          <div className="hero-actions"><Link className="btn btn-primary" href="/exams">Start Practising <span>→</span></Link><Link className="btn btn-outline" href="/pyq">Explore PYQs</Link></div>
          <p className="hero-note">A focused preparation space. Clear goals. Consistent practice.</p>
        </div>
        <div className="dashboard-preview" aria-label="Illustrative student dashboard preview">
          <div className="preview-top"><span className="preview-title">Your learning overview</span><span className="avatar">A</span></div>
          <div className="preview-welcome"><div><strong>Welcome back, Learner!</strong><p>Your next step starts with one good practice session.</p></div><span style={{fontSize:27}}>✦</span></div>
          <div className="mini-tiles"><div className="mini-tile"><b>12</b><span>Practice sets</span></div><div className="mini-tile"><b>08</b><span>Topics explored</span></div><div className="mini-tile"><b>74%</b><span>Sample accuracy</span></div></div>
          <div className="preview-lower">
            <div className="preview-panel"><h4>Weekly practice · sample view</h4><div className="bar-chart"><i style={{height:"35%"}}/><i style={{height:"58%"}}/><i style={{height:"45%"}}/><i style={{height:"82%"}}/><i style={{height:"65%"}}/><i style={{height:"92%"}}/><i style={{height:"72%"}}/></div></div>
            <div className="preview-panel"><h4>Practice goal</h4><div className="progress-ring"><span>74%</span></div><p style={{textAlign:"center",fontSize:9,color:"#64748b",margin:0}}>Illustrative preview</p></div>
          </div>
          <p style={{fontSize:9,color:"#94a3b8",margin:"12px 2px 0"}}>Illustrative dashboard preview — sample values, not live student data.</p>
        </div>
      </div>
      <div className="container search-wrap"><form className="search-box" action="/search"><span className="search-icon">⌕</span><input name="q" placeholder="Search exams, subjects, topics, mock tests or PYQs…" aria-label="Search MockMaster"/><button className="btn btn-primary" type="submit">Search</button></form><p className="search-hint">Popular searches: UGC NET Paper 1 · Commerce · Teaching Aptitude · Previous Year Papers</p></div>
      </section>
      <section className="section section-white"><div className="container"><div className="section-head"><span className="kicker">Explore examinations</span><h2>Choose your preparation path</h2><p>Start with an examination and discover its subjects, practice sets and previous-year questions.</p></div><div className="card-grid">{exams.map(e=><Link className="exam-card" href={e.href} key={e.name}><div className="exam-icon">{e.icon}</div><h3>{e.name}</h3><p>{e.desc}</p><span className="card-arrow">Explore examination →</span></Link>)}</div></div></section>
      <section className="section"><div className="container"><div className="section-head"><span className="kicker">Popular practice</span><h2>Build confidence, one test at a time</h2><p>Explore sample practice categories. Actual test availability and schedules will be managed through the platform.</p></div><div className="test-grid">{tests.map(t=><article className="test-card" key={t.name}><div className="test-top"><span className="tag">{t.exam}</span><span className="tag tag-green">Practice</span></div><p style={{fontWeight:700,color:"#2563eb",marginBottom:5}}>{t.type}</p><h3>{t.name}</h3><p>{t.detail}</p><div className="test-meta"><span>☷ {t.questions}</span><span>◷ {t.duration}</span></div><div className="test-bottom"><span>Preview listing</span><Link href="/mock-tests">View tests →</Link></div></article>)}</div></div></section>
      <section className="section section-white"><div className="container"><div className="section-head"><span className="kicker">Why MockMaster</span><h2>Everything organised around your goals</h2><p>Spend less time finding resources and more time practising with intent.</p></div><div className="feature-grid">{features.map(f=><article className="feature-card" key={String(f[1])}><div className="exam-icon">{f[0]}</div><h3>{f[1]}</h3><p>{f[2]}</p></article>)}</div></div></section>
      <section className="section"><div className="container"><div className="cta-band"><div><h2>Make your next practice session count.</h2><p>Explore examinations and find the right place to begin.</p></div><Link className="btn" style={{background:"white",color:"#1d4ed8"}} href="/exams">Explore examinations →</Link></div></div></section>
    </main>
    <footer className="site-footer"><div className="container"><div className="footer-grid">
      <div className="footer-brand"><Link className="brand" href="/" style={{color:"white"}}><span className="brand-mark">M</span>MockMaster</Link><p>Practice with purpose. Discover mock tests and previous-year questions for your competitive examination journey.</p></div>
      <div className="footer-col"><h4>Explore</h4><Link href="/exams">All examinations</Link><Link href="/mock-tests">Mock tests</Link><Link href="/pyq">Previous-year questions</Link><Link href="/about">About MockMaster</Link></div>
      <div className="footer-col"><h4>Examinations</h4>{exams.map(e=><Link href={e.href} key={e.name}>{e.name}</Link>)}</div>
      <div className="footer-col"><h4>Information</h4><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms & conditions</Link><Link href="/cookies">Cookie policy</Link><Link href="/disclaimer">Disclaimer</Link><Link href="/contact">Contact</Link></div>
    </div><div className="footer-bottom"><span>© {new Date().getFullYear()} MockMaster. All rights reserved.</span><span>Practice. Improve. Achieve.</span></div></div></footer>
  </>;
}
