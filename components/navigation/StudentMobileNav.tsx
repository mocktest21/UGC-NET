"use client";

import Link from "next/link";
import {House,ChartNoAxesCombined,Activity,BookOpen,Radio,NotebookPen} from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { label: "Dashboard", href: "/dashboard", Icon: House },
  { label: "Tracker", href: "/tracker", Icon: ChartNoAxesCombined },
  { label: "Analytics", href: "/analytics", Icon: Activity },
  { label: "Practice", href: "/practice", Icon: BookOpen },
  { label: "Live Test", href: "/live-test", Icon: Radio },
  { label: "Personal Notebook", href: "/personal-notebook", Icon: NotebookPen },
];

export default function StudentMobileNav() {
  const pathname = usePathname();
  const hiddenRoutes = ["/login", "/signup", "/onboarding", "/forgot-password", "/reset-password", "/about", "/contact", "/terms", "/privacy"];
  const isPublicOrAdmin = pathname === "/" || pathname.startsWith("/admin") || pathname.startsWith("/auth") || hiddenRoutes.some(path => pathname === path || pathname.startsWith(path + "/"));
  const isTestWindow = pathname.startsWith("/practice/session") || pathname.startsWith("/test/");
  if (isPublicOrAdmin || isTestWindow) return null;

  return (
    <nav className="mm-bottom-nav" aria-label="Student quick navigation">
      {items.map(item => {
        const Icon = item.Icon;
        const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} className={active ? "mm-bottom-link mm-bottom-active" : "mm-bottom-link"} href={item.href}>
            <span aria-hidden="true"><Icon size={18} strokeWidth={1.8}/></span>
            <small>{item.label}</small>
          </Link>
        );
      })}
    </nav>
  );
}
