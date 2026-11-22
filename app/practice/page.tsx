import type {Metadata} from "next";
import StudentSectionPage from "@/app/components/StudentSectionPage";

export const metadata:Metadata={title:"Practice Centre | MockMaster",description:"Build custom tests, revise incorrect questions and practise with MockMaster."};

export default function PracticePage() {
  return <StudentSectionPage section="practice" />;
}
