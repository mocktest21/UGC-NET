import type { Metadata } from "next";
import "./globals.css";
import StudentOnboardingGate from "@/components/auth/StudentOnboardingGate";
import StudentMobileNav from "@/components/navigation/StudentMobileNav";

export const metadata: Metadata = {
  title: "MockMaster — Practice. Improve. Achieve.",
  description:
    "A focused mock-test and previous-year-question practice platform for competitive examinations.",
  applicationName: "MockMaster",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><StudentOnboardingGate>{children}</StudentOnboardingGate><StudentMobileNav /></body>
    </html>
  );
}
