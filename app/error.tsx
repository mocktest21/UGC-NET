"use client";
import {useEffect} from "react";
export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error("Mock Buddy route error",error);},[error]);
 return <main className="mm-loading"><section className="mm-error-boundary" role="alert"><h1>Something went wrong</h1><p>This page could not be loaded. Your saved test responses are not affected by this screen.</p><button type="button" onClick={()=>reset()}>Try again</button></section></main>;
}