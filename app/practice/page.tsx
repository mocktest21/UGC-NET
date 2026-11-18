import type {Metadata} from "next";
export const metadata:Metadata={title:"Practice Centre | MockMaster",description:"Build a personalised UGC NET practice test."};
import StudentBuildTestPage from "@/app/practice/build-test/page";

export default function PracticePage() {
  return <StudentBuildTestPage />;
}
