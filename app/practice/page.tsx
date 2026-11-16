import type {Metadata} from "next";
export const metadata:Metadata={title:"Practice Centre | MockMaster",description:"Practice UGC NET mock tests and review completed live tests."};
import StudentSectionPage from "@/app/components/StudentSectionPage";

export default function PracticePage() {
  return <StudentSectionPage section="practice" />;
}
