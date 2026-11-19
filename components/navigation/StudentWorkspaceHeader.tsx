"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {BookOpen,BookMarked,House,Info,Radio,ChartNoAxesCombined,Activity} from "lucide-react";

const items=[
 {href:"/dashboard",label:"Dashboard",Icon:House},
 {href:"/tracker",label:"Tracker",Icon:ChartNoAxesCombined},
 {href:"/analytics",label:"Analytics",Icon:Activity},
 {href:"/practice",label:"Practice",Icon:BookOpen},
 {href:"/live-test",label:"Live Test",Icon:Radio},
 {href:"/personal-notebook",label:"Personal Notebook",Icon:BookMarked},
 {href:"/about",label:"About Us",Icon:Info},
];
export default function StudentWorkspaceHeader({name,rightSlot,leftSlot,showNav=true}:{name?:string;rightSlot?:React.ReactNode;leftSlot?:React.ReactNode;showNav?:boolean}){
 const pathname=usePathname();
 return <header className="mm-workspace-header mm-shared-student-header">
  {leftSlot}
  <Link className="mm-brand" href="/dashboard"><span className="mm-brand-mark">M</span><span>MockMaster</span></Link>
  {showNav&&<nav className="mm-workspace-nav" aria-label="Student navigation">{items.map(({href,label,Icon})=><Link key={href} href={href} className={pathname===href||pathname.startsWith(href+"/")?"active":""}><Icon size={15}/>{label}</Link>)}</nav>}
  {rightSlot}{name&&<span className="mm-workspace-user">{name}</span>}
 </header>;
}
