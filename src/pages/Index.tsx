import QuoteBuilder from "@/components/QuoteBuilder";
import { NexusProtectedHeader } from "@/components/NexusProtectedHeader";

export default function Index() {
  return (
    <div className="min-h-screen gradient-hero">
      <NexusProtectedHeader />
      <QuoteBuilder />
    </div>
  );
}
