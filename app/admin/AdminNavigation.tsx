"use client";
import { usePathname } from "next/navigation";
import "./admin-navigation.css";
type Props = { onSignOut?: () => void };
const links = [
 {label:"Overview",href:"/admin",key:"overview"},
 {label:"Question Bank",href:"/admin/questions",key:"questions"},
 {label:"Excel Imports",href:"/admin/questions?tab=import",key:"imports"},
 {label:"Test Builder",href:"/admin/tests",key:"tests"},
 {label:"Full-Length Tests",href:"/admin/full-length",key:"full-length"},
 {label:"Syllabus Manager",href:"/admin/syllabus",key:"syllabus"},
];
export default function AdminNavigation({onSignOut}:Props){
 const pathname=usePathname();
 const active=pathname==="/admin"?"overview":pathname.startsWith("/admin/questions")?"questions":pathname.startsWith("/admin/full-length")?"full-length":pathname.startsWith("/admin/tests")?"tests":pathname.startsWith("/admin/syllabus")?"syllabus":"";
 return <header className="admin-nav">
  <a className="admin-nav-brand" href="/admin"><span>M</span><b>Mock Buddy</b><small>ADMIN</small></a>
  <nav aria-label="Admin navigation">{links.map(item=><a key={item.key} href={item.href} className={active===item.key?"active":""} aria-current={active===item.key?"page":undefined}>{item.label}</a>)}</nav>
  <div className="admin-nav-actions"><a href="/dashboard">Student site ↗</a>{onSignOut&&<button type="button" onClick={onSignOut}>Sign out</button>}</div>
 </header>;
}
