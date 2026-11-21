"use client";

import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {BookOpen,BookMarked,House,Info,Radio,Activity,GraduationCap,Menu,X,UserRound,LogOut,ChevronDown} from "lucide-react";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";

const items=[
 {href:"/dashboard",label:"Home",Icon:House},
 {href:"/analytics",label:"Analytics",Icon:Activity},
 {href:"/practice",label:"Practice",Icon:BookOpen},
 {href:"/live-test",label:"Live Test",Icon:Radio},
 {href:"/personal-notebook",label:"Personal Notebook",Icon:BookMarked},
 {href:"/mentorship",label:"Mentorship",Icon:GraduationCap},
 {href:"/about",label:"About Us",Icon:Info},
];
export default function StudentWorkspaceHeader({name,rightSlot,leftSlot,mobileMenuExtra,showNav=true}:{name?:string;rightSlot?:React.ReactNode;leftSlot?:React.ReactNode;mobileMenuExtra?:React.ReactNode;showNav?:boolean}){
 const pathname=usePathname();
 const router=useRouter();
 const [resolvedName,setResolvedName]=useState(name||"");
 useEffect(()=>{if(name){setResolvedName(name);return;}let active=true;const db=createSupabaseBrowserClient();void db.auth.getUser().then(({data})=>{if(!active)return;const user=data.user;setResolvedName(user?.user_metadata?.full_name||user?.email?.split("@")[0]||"Student");});return()=>{active=false;};},[name]);
 const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
 const [profileOpen,setProfileOpen]=useState(false);
 const [signingOut,setSigningOut]=useState(false);
 async function signOut(){setSigningOut(true);try{const db=createSupabaseBrowserClient();await db.auth.signOut();router.replace("/login");}finally{setSigningOut(false);}}
 return <>
 <header className="mm-workspace-header mm-shared-student-header">
  <div className="mm-header-leading">{leftSlot}{showNav&&<button type="button" className="mm-mobile-menu-toggle" aria-label={mobileMenuOpen?"Close navigation":"Open navigation"} aria-expanded={mobileMenuOpen} onClick={()=>setMobileMenuOpen(v=>!v)}>{mobileMenuOpen?<X size={21}/>:<Menu size={21}/>}</button>}<Link className="mm-brand" href="/dashboard"><span className="mm-brand-mark">M</span><span>MockMaster</span></Link></div>
  {showNav&&<nav className="mm-workspace-nav" aria-label="Student navigation">{items.map(({href,label,Icon})=><Link key={href} href={href} className={pathname===href||pathname.startsWith(href+"/")?"active":""}><Icon size={15}/>{label}</Link>)}</nav>}
  <div className="mm-header-account">{rightSlot || (resolvedName&&<div className="mm-shared-profile-wrap"><button type="button" className="mm-shared-profile-trigger" onClick={()=>setProfileOpen(v=>!v)} aria-expanded={profileOpen}><span className="mm-shared-profile-avatar"><UserRound size={17}/></span><span className="mm-shared-profile-name">{resolvedName}</span><ChevronDown size={15}/></button>{profileOpen&&<div className="mm-shared-profile-menu"><div className="mm-shared-profile-caption">STUDENT ACCOUNT</div><strong>{resolvedName}</strong><Link href="/profile" onClick={()=>setProfileOpen(false)}><UserRound size={15}/>View profile</Link><button type="button" disabled={signingOut} onClick={()=>void signOut()}><LogOut size={15}/>{signingOut?"Logging out…":"Log out"}</button></div>}</div>)}</div>
 </header>
 {showNav&&mobileMenuOpen&&typeof document!=="undefined"&&createPortal(<><button className="mm-mobile-menu-backdrop" aria-label="Close navigation menu" onClick={()=>setMobileMenuOpen(false)}/><nav className="mm-mobile-menu-panel" aria-label="Mobile student navigation"><div className="mm-mobile-sheet-head"><div><span>MOCKMASTER MENU</span><strong>Navigate your workspace</strong></div><button type="button" aria-label="Close menu" onClick={()=>setMobileMenuOpen(false)}><X size={21}/></button></div>{items.map(({href,label,Icon})=><Link key={href} href={href} className={pathname===href||pathname.startsWith(href+"/")?"active":""} onClick={()=>setMobileMenuOpen(false)}><Icon size={18}/>{label}</Link>)}{mobileMenuExtra?<div className="mm-mobile-menu-extra">{mobileMenuExtra}</div>:<div className="mm-mobile-menu-extra mm-shared-mobile-account"><strong>{resolvedName||"Student"}</strong><Link href="/profile" onClick={()=>setMobileMenuOpen(false)}><UserRound size={16}/>View profile</Link><button type="button" disabled={signingOut} onClick={()=>void signOut()}><LogOut size={16}/>{signingOut?"Logging out…":"Log out"}</button></div>}</nav></>,document.body)}
 </>;
}
