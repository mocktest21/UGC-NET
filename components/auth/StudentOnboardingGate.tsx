"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function StudentOnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/" || pathname === "/login" || pathname === "/signup" ||
        pathname.startsWith("/admin") || pathname.startsWith("/auth") ||
        pathname === "/forgot-password" || pathname === "/reset-password" ||
        pathname === "/onboarding") return;
    let active = true;
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      if (user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin") return;
      if (user.user_metadata?.onboarding_completed !== true) router.replace("/onboarding");
    })();
    return () => { active = false; };
  }, [pathname, router]);

  return <>{children}</>;
}
