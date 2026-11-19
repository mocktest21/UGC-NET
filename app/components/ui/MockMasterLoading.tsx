"use client";

import {useEffect,useState} from "react";

type LoadingVariant="workspace"|"builder"|"admin"|"notebook"|"table"|"session";
type Props={variant?:LoadingVariant;message?:string;title?:string};

const messages=[
 "Sit back and relax — we're getting everything ready for you.",
 "Preparing your workspace…",
 "Gathering the latest information for you…",
 "Almost there — arranging everything neatly."
];

export default function MockMasterLoading({variant="workspace",message,title="Getting things ready"}:Props){
 const [messageIndex,setMessageIndex]=useState(0);
 const [takingLonger,setTakingLonger]=useState(false);
 useEffect(()=>{
  const rotate=window.setInterval(()=>setMessageIndex(v=>(v+1)%messages.length),3200);
  const slow=window.setTimeout(()=>setTakingLonger(true),12000);
  return()=>{window.clearInterval(rotate);window.clearTimeout(slow);};
 },[]);
 return <main className={"mm-loading-screen mm-loading-"+variant} aria-busy="true" aria-live="polite">
  {variant!=="session"&&<header className="mm-loading-topbar">
   <div className="mm-loading-brand"><span>M</span><i/></div>
   <div className="mm-loading-nav"><i/><i/><i/><i/></div>
   <div className="mm-loading-profile"/>
  </header>}
  <section className="mm-loading-content">
   {variant!=="session"&&<div className="mm-loading-heading">
    <div className="mm-skeleton mm-sk-title"/>
    <div className="mm-skeleton mm-sk-subtitle"/>
   </div>}
   {variant==="session"&&<div className="mm-loading-session-heading"><span>Preparing your test</span><i/></div>}
   {variant==="session"?<div className="mm-loading-session">
    <div className="mm-skeleton mm-sk-question-meta"/>
    <div className="mm-skeleton mm-sk-question"/>
    {Array.from({length:4},(_,i)=><div className="mm-skeleton mm-sk-option" key={i}/>)}
   </div>:variant==="table"?<div className="mm-loading-panel">
    <div className="mm-loading-toolbar"><i/><i/><i/></div>
    {Array.from({length:7},(_,i)=><div className="mm-loading-table-row" key={i}><i/><span/><span/><span/><i/></div>)}
   </div>:variant==="builder"?<div className="mm-loading-builder">
    <div className="mm-loading-panel"><div className="mm-skeleton mm-sk-label"/><div className="mm-loading-papers">{Array.from({length:2},(_,i)=><i key={i}/>)}</div><div className="mm-skeleton mm-sk-label"/><div className="mm-loading-units">{Array.from({length:8},(_,i)=><i key={i}/>)}</div><div className="mm-skeleton mm-sk-label"/><div className="mm-loading-controls">{Array.from({length:5},(_,i)=><i key={i}/>)}</div></div>
    <div className="mm-loading-panel mm-loading-summary"><div className="mm-skeleton mm-sk-label"/><i/><i/><i/><b/></div>
   </div>:<><div className="mm-loading-stats">{Array.from({length:variant==="admin"?4:3},(_,i)=><div className="mm-loading-panel" key={i}><i/><b/></div>)}</div><div className="mm-loading-panel mm-loading-wide"><div className="mm-skeleton mm-sk-label"/>{Array.from({length:variant==="notebook"?3:5},(_,i)=><div className="mm-loading-list-row" key={i}><i/><span/><b/></div>)}</div></>}
   <div className="mm-loading-message">
    <span className="mm-loading-orbit"><i/></span>
    <strong>{title}</strong>
    <p>{message||messages[messageIndex]}</p>
    {takingLonger&&<div className="mm-loading-slow" role="status"><b>Taking longer than expected…</b><span>Please check your internet connection. Your data is safe. Please check your internet connection while we continue loading.</span><small>If this continues, refresh the page and try again.</small></div>}
   </div>
  </section>
 </main>;
}
