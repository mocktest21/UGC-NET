"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {BookOpen,ChartNoAxesColumn,House,Info,Radio} from "lucide-react";

const items=[
 {href:"/dashboard",label:"Dashboard",Icon:House},
 {href:"/practice",label:"Practice",Icon:BookOpen},
 {href:"/live-test",label:"Live Test",Icon:Radio},
 {href:"/personal-notebook",label:"Personal Notebook",Icon:ChartNoAxesColumn},
 {href:"/about",label:"About Us",Icon:Info},
];
export default function StudentWorkspaceHeader({name,rightSlot,leftSlot,showNav=true}:{name?:string;rightSlot?:React.ReactNode;leftSlot?:React.ReactNode;showNav?:boolean}){
 const pathname=usePathname();
 return <header className="mm-shared-student-header">
  {leftSlot}
  <Link className="mm-brand" href="/dashboard"><span className="mm-brand-mark">M</span><span>MockMaster</span></Link>
  {showNav&&<nav aria-label="Student navigation">{items.map(({href,label,Icon})=><Link key={href} href={href} className={pathname===href?"active":""}><Icon size={15}/>{label}</Link>)}</nav>}
  {rightSlot}{name&&<span className="mm-shared-student-name">Hey, {name}!</span>}
 </header>;
}
