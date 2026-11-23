import type { Metadata } from "next";
import "./globals.css";
import {Poppins} from "next/font/google";
import StudentOnboardingGate from "@/components/auth/StudentOnboardingGate";
import StudentMobileNav from "@/components/navigation/StudentMobileNav";

const poppins=Poppins({subsets:["latin"],weight:["400","500","600","700","800"],display:"swap",variable:"--font-poppins"});

export const metadata: Metadata = {
  title: "Mock Buddy — Practice. Improve. Achieve.",
  description:
    "A focused mock-test and previous-year-question practice platform for competitive examinations.",
  applicationName: "Mock Buddy",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body><StudentOnboardingGate>{children}</StudentOnboardingGate><StudentMobileNav /></body>
    </html>
  );
}
