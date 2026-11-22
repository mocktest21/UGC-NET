import type {Metadata} from "next";
import Link from "next/link";
import {Instagram,Send,MessageCircle,Mail,ArrowUpRight,Headset} from "lucide-react";
import "./contact.css";

export const metadata:Metadata={
 title:"Contact MockMaster",
 description:"Connect with MockMaster through Instagram, Telegram, WhatsApp or email."
};

const contacts=[
 {name:"Instagram",handle:"@mockmaster_demo",detail:"Follow updates and announcements",href:"https://instagram.com/mockmaster_demo",Icon:Instagram,tone:"instagram"},
 {name:"Telegram",handle:"t.me/mockmaster_demo",detail:"Join the student community",href:"https://t.me/mockmaster_demo",Icon:Send,tone:"telegram"},
 {name:"WhatsApp",handle:"+91 90000 00000",detail:"Chat with our support team",href:"https://wa.me/910000000000",Icon:MessageCircle,tone:"whatsapp"},
 {name:"Gmail",handle:"support@example.com",detail:"Send us your questions by email",href:"mailto:support@example.com",Icon:Mail,tone:"gmail"}
];

export default function Contact(){
 return <main className="mm-contact-page">
  <div className="mm-contact-container">
   <div className="mm-contact-crumb"><Link href="/dashboard">Home</Link><span>/</span>Contact Us</div>
   <header className="mm-contact-heading">
    <span className="mm-contact-kicker"><Headset size={15}/> WE’RE HERE TO HELP</span>
    <h1>Contact <span>MockMaster</span></h1>
    <p>Have a question, suggestion or need help? Reach out to us through any of the channels below.</p>
   </header>
   <section className="mm-contact-grid" aria-label="Contact channels">
    {contacts.map(({name,handle,detail,href,Icon,tone})=><a className={`mm-contact-card ${tone}`} href={href} key={name} target={href.startsWith("http")?"_blank":undefined} rel={href.startsWith("http")?"noopener noreferrer":undefined}>
      <span className="mm-contact-icon"><Icon size={27}/></span>
      <span className="mm-contact-copy"><strong>{name}</strong><b>{handle}</b><small>{detail}</small></span>
      <ArrowUpRight className="mm-contact-arrow" size={19}/>
    </a>)}
   </section>
   <p className="mm-contact-demo-note">Demo contact details are shown for now. Official social links and support contact information will be updated before launch.</p>
   <Link href="/dashboard" className="mm-contact-back">← Back to Home</Link>
  </div>
 </main>;
}
