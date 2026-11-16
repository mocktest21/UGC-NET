import type {Metadata} from "next";
export const metadata:Metadata={title:"Live Tests | MockMaster",description:"View upcoming and active MockMaster live tests, recent results and leaderboards."};
import StudentSectionPage from "@/app/components/StudentSectionPage";

export default function LiveTestPage() {
  return <StudentSectionPage section="live-test" />;
}
