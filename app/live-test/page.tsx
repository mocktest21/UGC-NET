import type {Metadata} from "next";
export const metadata:Metadata={title:"Live Tests | Mock Buddy",description:"View upcoming and active Mock Buddy live tests, recent results and leaderboards."};
import StudentSectionPage from "@/app/components/StudentSectionPage";

export default function LiveTestPage() {
  return <StudentSectionPage section="live-test" />;
}
