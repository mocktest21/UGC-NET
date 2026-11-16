import type {Metadata} from "next";
export const metadata:Metadata={title:"Contact MockMaster",description:"Contact MockMaster for platform questions and support."};
import Link from "next/link";
export default function Contact() {
  return <main className="container"><div className="page-hero"><div className="crumb"><Link href="/">Home</Link> / Contact</div><h1>Contact MockMaster</h1><p>For platform questions and support, contact details and a secure enquiry workflow will be published here before launch.</p></div><div className="empty-panel" style={{marginBottom:80}}>Support enquiries are not yet enabled. Please check back when the platform launch information is published.</div></main>;
}
