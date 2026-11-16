import Link from "next/link";
const sections = [["🎯","Our mission","Make exam practice easier to discover, structured to follow and meaningful to review."],["🌱","Our vision","Build a dependable preparation space that can grow with learners and their goals."],["📚","Our approach","Bring practice, previous-year questions and organised subject pathways together."]];
export default function About() {
  return <main className="container"><div className="page-hero"><div className="crumb"><Link href="/">Home</Link> / About</div><span className="eyebrow">About MockMaster</span><h1>Preparation deserves clarity.</h1><p>MockMaster is being built as a focused practice platform for learners preparing for competitive examinations. Our aim is to organise examinations, subjects, mock tests and previous-year questions in one clear learning space.</p></div>
    <div className="feature-grid" style={{paddingBottom:80}}>{sections.map(s=><article className="feature-card" key={s[1]}><div className="exam-icon">{s[0]}</div><h3>{s[1]}</h3><p>{s[2]}</p></article>)}</div>
  </main>;
}
