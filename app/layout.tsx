import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
