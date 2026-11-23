import type { Metadata } from "next";
import Link from "next/link";
import StudentWorkspaceHeader from "@/components/navigation/StudentWorkspaceHeader";
import { GraduationCap, ArrowLeft } from "lucide-react";
import "./mentorship.css";

export const metadata: Metadata = {
  title: "Mentorship | Mock Buddy",
  description: "Mentorship at Mock Buddy — coming soon.",
};

export default function MentorshipPage() {
  return (
    <main className="mm-mentorship-page">
      <StudentWorkspaceHeader />
      <section className="mm-mentorship-wrap">
        <Link className="mm-mentorship-back" href="/dashboard"><ArrowLeft size={15}/> Back to Dashboard</Link>
        <div className="mm-mentorship-card">
          <div className="mm-mentorship-icon"><GraduationCap size={30}/></div>
          <span className="mm-mentorship-kicker">Mock Buddy MENTORSHIP</span>
          <h1>Guidance for your next step.</h1>
          <p>We’re preparing a mentorship experience to help aspirants get structured academic guidance and make informed preparation decisions.</p>
          <span className="mm-mentorship-status">Coming Soon</span>
          <div className="mm-mentorship-placeholder">
            <strong>What’s coming here?</strong>
            <p>Mentor profiles, mentorship formats and programme details will be shared here once the feature is ready.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
