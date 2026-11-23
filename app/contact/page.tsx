import type {Metadata} from "next";
import Link from "next/link";
import {ArrowUpRight,Headset} from "lucide-react";
import "./contact.css";

export const metadata:Metadata={
 title:"Contact Mock Buddy",
 description:"Connect with Mock Buddy through Instagram, Telegram, WhatsApp or email."
};

function BrandLogo({brand}:{brand:"instagram"|"telegram"|"whatsapp"|"gmail"}){
 if(brand==="instagram")return <svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="ig-gradient" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#FFB13D"/><stop offset=".48" stopColor="#E1306C"/><stop offset="1" stopColor="#833AB4"/></linearGradient></defs><rect x="7" y="7" width="34" height="34" rx="10" fill="none" stroke="url(#ig-gradient)" strokeWidth="3.5"/><circle cx="24" cy="24" r="8" fill="none" stroke="url(#ig-gradient)" strokeWidth="3.5"/><circle cx="34" cy="14" r="2.4" fill="#E1306C"/></svg>;
 if(brand==="telegram")return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#229ED9"/><path d="m10.5 23 25-9.6c1.2-.4 2.2.3 1.8 2l-4.3 20.2c-.3 1.5-1.2 1.9-2.5 1.1l-7-5.2-3.4 3.3c-.4.4-.8.8-1.6.8l.5-7.2 13.1-11.8c.6-.5-.1-.8-.8-.4L15.1 26l-6.8-2.1c-1.5-.5-1.5-1.5 2.2-2.9Z" fill="#fff"/></svg>;
 if(brand==="whatsapp")return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#25D366" d="M24 4a19.4 19.4 0 0 0-16.7 29.3L5 43l10-2.2A19.5 19.5 0 1 0 24 4Z"/><path fill="#fff" d="M24 8a15.5 15.5 0 0 0-13.2 23.7l.5.8-1.4 5.1 5.3-1.4.8.5A15.5 15.5 0 1 0 24 8Zm8.8 22.1c-.4 1.1-2.2 2.1-3.1 2.2-.8.1-1.8.2-2.9-.2-.7-.2-1.6-.5-2.7-1-4.7-2-7.8-6.8-8-7.1-.2-.3-1.9-2.5-1.9-4.8s1.2-3.4 1.7-3.9c.4-.4.9-.5 1.2-.5h.9c.3 0 .7-.1 1 .8.4.9 1.3 3.2 1.4 3.4.1.2.2.5 0 .8-.1.3-.2.5-.5.8-.2.3-.5.6-.7.8-.2.2-.5.5-.2 1 .3.5 1.3 2.1 2.8 3.4 1.9 1.7 3.5 2.2 4 2.4.5.2.8.2 1.1-.2.3-.4 1.2-1.4 1.5-1.9.3-.5.6-.4 1-.2.4.2 2.7 1.3 3.2 1.5.5.2.8.4.9.6.1.2.1 1.2-.3 2.3Z"/></svg>;
 return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 36V12l18 14L42 12v24" fill="none" stroke="#4285F4" strokeWidth="5" strokeLinejoin="round"/><path d="M6 12 24 26 42 12" fill="none" stroke="#EA4335" strokeWidth="5" strokeLinejoin="round"/><path d="M6 12v24" stroke="#34A853" strokeWidth="5"/><path d="M42 12v24" stroke="#FBBC04" strokeWidth="5"/></svg>;
}

const contacts=[
 {name:"Instagram",handle:"@mockmaster_demo",detail:"Follow updates and announcements",href:"https://instagram.com/mockmaster_demo",brand:"instagram" as const},
 {name:"Telegram",handle:"t.me/mockmaster_demo",detail:"Join the student community",href:"https://t.me/mockmaster_demo",brand:"telegram" as const},
 {name:"WhatsApp",handle:"+91 90000 00000",detail:"Chat with our support team",href:"https://wa.me/919000000000",brand:"whatsapp" as const},
 {name:"Gmail",handle:"support@example.com",detail:"Send us your questions by email",href:"mailto:support@example.com",brand:"gmail" as const}
];

export default function Contact(){
 return <main className="mm-contact-page">
  <div className="mm-contact-container">
   <div className="mm-contact-crumb"><Link href="/dashboard">Home</Link><span>/</span>Contact Us</div>
   <header className="mm-contact-heading">
    <span className="mm-contact-kicker"><Headset size={15}/> WE’RE HERE TO HELP</span>
    <h1>Contact <span>Mock Buddy</span></h1>
    <p>Have a question, suggestion or need help? Reach out to us through any of the channels below.</p>
   </header>
   <section className="mm-contact-grid" aria-label="Contact channels">
    {contacts.map(({name,handle,detail,href,brand})=><a className={`mm-contact-card ${brand}`} href={href} key={name} target={href.startsWith("http")?"_blank":undefined} rel={href.startsWith("http")?"noopener noreferrer":undefined}>
      <span className="mm-contact-icon"><BrandLogo brand={brand}/></span>
      <span className="mm-contact-copy"><strong>{name}</strong><b>{handle}</b><small>{detail}</small></span>
      <ArrowUpRight className="mm-contact-arrow" size={19}/>
    </a>)}
   </section>
   <p className="mm-contact-demo-note">Demo contact details are shown for now. These are placeholder accounts and are not active support channels. Official contact details will be added before launch.</p>
   <Link href="/dashboard" className="mm-contact-back">← Back to Home</Link>
  </div>
 </main>;
}
