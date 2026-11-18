import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Target, GraduationCap, BookOpen, BriefcaseBusiness, Award, Laptop, ArrowRight } from "lucide-react";
import "./about.css";

export const metadata: Metadata = {
  title: "About Us | MockMaster",
  description: "Meet the co-founders behind MockMaster and learn about our mission to make exam preparation accessible.",
};

const founders = [
  {
    name: "Manish Mishra",
    role: "Co-Founder",
    image: "/founders/manish.jpg",
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
    image: "/founders/amrita.jpg",
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

export default function About() {
  return (
    <main className="about-page">
      <section className="about-hero">
        <div className="about-crumb"><Link href="/">Home</Link><span>/</span>About</div>
        <span className="about-kicker">THE PEOPLE BEHIND MOCKMASTER</span>
        <h1>Meet the <span>Founders</span></h1>
        <p>Building a focused, accessible and student-first space for meaningful exam preparation.</p>
      </section>

      <section className="founder-grid" aria-label="MockMaster founders">
        {founders.map((founder) => (
          <article className="founder-card" key={founder.name}>
            <div className="founder-photo">
              <Image src={founder.image} alt={founder.imageAlt} fill sizes="(max-width: 760px) 80vw, 300px" priority />
            </div>
            <div className="founder-info">
              <h2>{founder.name}</h2>
              <span className="founder-role">{founder.role}</span>
              <ul className="founder-credentials">
                {founder.credentials.map(({icon: Icon, text}) => (
                  <li key={text}><Icon size={19} strokeWidth={1.8}/><span>{text}</span></li>
                ))}
              </ul>
              <p className="founder-bio">{founder.bio}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="about-vision">
        <div className="vision-heading"><Target size={34}/><h2>Our Shared Vision</h2></div>
        <p>To build a trusted, free and student-first preparation platform that empowers aspirants of <strong>UGC NET</strong> and other competitive examinations to practise, assess their progress and move closer to their goals.</p>
      </section>

      <section className="about-bottom">
        <div><span className="about-kicker">YOUR PREPARATION. YOUR PROGRESS.</span><h2>Every practice session should move you forward.</h2><p>Explore examinations, mock tests and previous-year questions on MockMaster.</p></div>
        <Link href="/exams" className="about-cta">Explore examinations <ArrowRight size={17}/></Link>
      </section>
    </main>
  );
}
