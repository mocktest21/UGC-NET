"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Dashboard", href: "/dashboard", icon: "⌂" },
  { label: "Practice", href: "/practice", icon: "◎" },
  { label: "Live Test", href: "/live-test", icon: "◷" },
  { label: "Personal Notebook", href: "/personal-notebook", icon: "▤" },
];

export default function StudentMobileNav() {
  const pathname = usePathname();
  const hiddenRoutes = ["/login", "/signup", "/onboarding", "/forgot-password", "/reset-password"];
  const isPublicOrAdmin = pathname === "/" || pathname.startsWith("/admin") || pathname.startsWith("/auth") || hiddenRoutes.some(path => pathname === path || pathname.startsWith(path + "/"));
  const isTestWindow = pathname.startsWith("/practice/session") || pathname.startsWith("/test/");
  if (isPublicOrAdmin || isTestWindow) return null;

  return (
    <nav className="mm-bottom-nav" aria-label="Student quick navigation">
      {items.map(item => {
        const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} className={active ? "mm-bottom-link mm-bottom-active" : "mm-bottom-link"} href={item.href}>
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
          </Link>
        );
      })}
    </nav>
  );
}
