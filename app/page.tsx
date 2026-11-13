const exams = [
  { icon: "📘", name: "UGC NET", desc: "Paper 1 and subject-wise Paper 2 practice", href: "/exams/ugc-net" },
  { icon: "🎯", name: "SSC", desc: "Prepare for SSC competitive examinations", href: "/exams/ssc" },
  { icon: "🏛️", name: "UPSC", desc: "Build a consistent civil services practice routine", href: "/exams/upsc" },
  { icon: "🏦", name: "Banking", desc: "Practice banking and aptitude questions", href: "/exams/banking" },
  { icon: "🚆", name: "Railways", desc: "Explore railway recruitment exam practice", href: "/exams/railways" },
];
const tests = [
  { exam: "UGC NET", type: "Paper 1", name: "Teaching & Research Aptitude", detail: "A focused practice set covering core Paper 1 areas.", questions: "50 questions", duration: "60 min" },
  { exam: "UGC NET", type: "Commerce", name: "Commerce – Mixed Practice", detail: "A subject-wise practice set for Commerce aspirants.", questions: "50 questions", duration: "60 min" },
  { exam: "UGC NET", type: "Management", name: "Management – Mixed Practice", detail: "Review key Management concepts through MCQs.", questions: "50 questions", duration: "60 min" },
];
const features = [
  ["🧭", "Structured preparation", "Find examinations, subjects, topics and practice sets in a clear hierarchy."],
  ["📊", "Meaningful progress", "A focused practice experience designed to help you identify what to revise next."],
  ["📝", "Previous-year questions", "Browse papers by examination, subject and year, all in one organised place."],
  ["🔎", "Quick discovery", "Search across examinations, subjects, topics, mock tests and PYQs."],
  ["📱", "Designed for every screen", "A responsive experience for desktop, tablet and mobile."],
  ["🎓", "A focused learning space", "A clean, distraction-free environment built around exam preparation."],
];
export default function Home() {
  return <>
    <header className="site-header"><div className="container nav">
      <a className="brand" href="/"><span className="brand-mark">M</span>MockMaster</a>
      <nav className="nav-links"><a href="/">Home</a><a href="/exams">Exams</a><a href="/mock-tests">Mock Tests</a><a href="/pyq">PYQs</a><a href="/About">About</a></nav>
      <div className="nav-actions"><a className="btn btn-outline desktop-login" href="/login">Log in</a><a className="btn btn-primary desktop-signup" href="/signup">Sign up <span>→</span></a><details className="mobile-nav"><summary aria-label="Open navigation menu">☰ <span>Menu</span></summary><div className="mobile-nav-panel"><a href="/exams">Examinations</a><a href="/mock-tests">Mock Tests</a><a href="/pyq">Previous-year questions</a><a href="/About">About</a><a href="/login">Log in</a><a className="mobile-nav-cta" href="/signup">Create free account →</a></div></details></div>
    </div></header>
    <main>
      <section className="hero"><div className="container hero-grid">
        <div><span className="eyebrow"><i className="eyebrow-dot"/> A smarter way to practise</span>
          <h1>Practice.<br/><span>Improve.</span> Achieve.</h1>
          <p className="hero-copy">Prepare with purpose. Explore mock tests and previous-year questions across competitive examinations, and make every practice session count.</p>
          <div className="hero-actions"><a className="btn btn-primary" href="/exams">Start Practising <span>→</span></a><a className="btn btn-outline" href="/pyq">Explore PYQs</a></div>
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
      <section className="section section-white"><div className="container"><div className="section-head"><span className="kicker">Explore examinations</span><h2>Choose your preparation path</h2><p>Start with an examination and discover its subjects, practice sets and previous-year questions.</p></div><div className="card-grid">{exams.map(e=><a className="exam-card" href={e.href} key={e.name}><div className="exam-icon">{e.icon}</div><h3>{e.name}</h3><p>{e.desc}</p><span className="card-arrow">Explore examination →</span></a>)}</div></div></section>
      <section className="section"><div className="container"><div className="section-head"><span className="kicker">Popular practice</span><h2>Build confidence, one test at a time</h2><p>Explore sample practice categories. Actual test availability and schedules will be managed through the platform.</p></div><div className="test-grid">{tests.map(t=><article className="test-card" key={t.name}><div className="test-top"><span className="tag">{t.exam}</span><span className="tag tag-green">Practice</span></div><p style={{fontWeight:700,color:"#2563eb",marginBottom:5}}>{t.type}</p><h3>{t.name}</h3><p>{t.detail}</p><div className="test-meta"><span>☷ {t.questions}</span><span>◷ {t.duration}</span></div><div className="test-bottom"><span>Preview listing</span><a href="/mock-tests">View tests →</a></div></article>)}</div></div></section>
      <section className="section section-white"><div className="container"><div className="section-head"><span className="kicker">Why MockMaster</span><h2>Everything organised around your goals</h2><p>Spend less time finding resources and more time practising with intent.</p></div><div className="feature-grid">{features.map(f=><article className="feature-card" key={f[1]}><div className="exam-icon">{f[0]}</div><h3>{f[1]}</h3><p>{f[2]}</p></article>)}</div></div></section>
      <section className="section"><div className="container"><div className="cta-band"><div><h2>Make your next practice session count.</h2><p>Explore examinations and find the right place to begin.</p></div><a className="btn" style={{background:"white",color:"#1d4ed8"}} href="/exams">Explore examinations →</a></div></div></section>
    </main>
    <footer className="site-footer"><div className="container"><div className="footer-grid">
      <div className="footer-brand"><a className="brand" href="/" style={{color:"white"}}><span className="brand-mark">M</span>MockMaster</a><p>Practice with purpose. Discover mock tests and previous-year questions for your competitive examination journey.</p></div>
      <div className="footer-col"><h4>Explore</h4><a href="/exams">All examinations</a><a href="/mock-tests">Mock tests</a><a href="/pyq">Previous-year questions</a><a href="/About">About MockMaster</a></div>
      <div className="footer-col"><h4>Examinations</h4>{exams.map(e=><a href={e.href} key={e.name}>{e.name}</a>)}</div>
      <div className="footer-col"><h4>Information</h4><a href="/privacy">Privacy policy</a><a href="/terms">Terms & conditions</a><a href="/cookies">Cookie policy</a><a href="/disclaimer">Disclaimer</a><a href="/Contact">Contact</a></div>
    </div><div className="footer-bottom"><span>© {new Date().getFullYear()} MockMaster. All rights reserved.</span><span>Practice. Improve. Achieve.</span></div></div></footer>
  </>;
}
