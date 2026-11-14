"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function StudentOnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = pathname === "/" || pathname === "/login" || pathname === "/signup" ||
    pathname.startsWith("/admin") || pathname.startsWith("/auth") ||
    pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/onboarding";
  const [checking, setChecking] = useState(!isPublic);

  useEffect(() => {
    if (isPublic) { setChecking(false); return; }
    let active = true;
    setChecking(true);
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { router.replace("/login"); return; }
      if (user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin") { setChecking(false); return; }
      if (user.user_metadata?.onboarding_completed !== true) { router.replace("/onboarding"); return; }
      setChecking(false);
    })();
    return () => { active = false; };
  }, [isPublic, pathname, router]);

  if (checking) return <main className="mm-onboarding-page"><div className="mm-onboarding-card">Checking your account…</div></main>;
  return <>{children}</>;
}
