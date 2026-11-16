import type { Metadata } from "next";
import "./globals.css";
import {Poppins} from "next/font/google";
const poppins=Poppins({subsets:["latin"],weight:["400","500","600","700","800"],display:"swap",variable:"--font-poppins"});
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
    <html lang="en" className={poppins.variable}>
      <body><StudentOnboardingGate>{children}</StudentOnboardingGate><StudentMobileNav /></body>
    </html>
  );
}
