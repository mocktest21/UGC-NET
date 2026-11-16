import type {Metadata} from "next";
export const metadata:Metadata={title:"About MockMaster",description:"Learn about the MockMaster exam practice platform."};
import Link from "next/link";
import {Target,Sprout,BookOpen} from "lucide-react";
const sections = [{icon:Target,title:"Our mission",detail:"Make exam practice easier to discover, structured to follow and meaningful to review."},{icon:Sprout,title:"Our vision",detail:"Build a dependable preparation space that can grow with learners and their goals."},{icon:BookOpen,title:"Our approach",detail:"Bring practice, previous-year questions and organised subject pathways together."}];
export default function About() {
  return <main className="container"><div className="page-hero"><div className="crumb"><Link href="/">Home</Link> / About</div><span className="eyebrow">About MockMaster</span><h1>Preparation deserves clarity.</h1><p>MockMaster is being built as a focused practice platform for learners preparing for competitive examinations. Our aim is to organise examinations, subjects, mock tests and previous-year questions in one clear learning space.</p></div>
    <div className="feature-grid" style={{paddingBottom:80}}>{sections.map(s=>{const Icon=s.icon;return <article className="feature-card" key={s.title}><div className="exam-icon"><Icon size={21} strokeWidth={1.8}/></div><h3>{s.title}</h3><p>{s.detail}</p></article>;})}</div>
  </main>;
}
