import { NexusProtectedHeader } from "@/components/NexusProtectedHeader";
import QuoteBuilder from "@/components/QuoteBuilder";

export default function Orcamento() {
  return (
    <div className="min-h-svh gradient-hero">
      <NexusProtectedHeader />
      <QuoteBuilder />
    </div>
  );
}
