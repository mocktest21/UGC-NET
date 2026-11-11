import Link from "next/link";
export default function NotFound() {
  return <main className="container"><div className="page-hero"><span className="eyebrow">404 · Page not found</span><h1>We couldn't find that page.</h1><p>The page may have moved or the address may be incorrect.</p><Link className="btn btn-primary" href="/">Back to homepage</Link></div></main>;
}
