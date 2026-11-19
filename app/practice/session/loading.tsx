import MockMasterLoading from "@/app/components/ui/MockMasterLoading";

export default function TestSessionLoading(){
  return <MockMasterLoading variant="session" title="Preparing your test" message="Loading your questions and saved responses…" />;
}
