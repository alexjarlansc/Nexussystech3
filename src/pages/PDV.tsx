import { NexusProtectedHeader } from "@/components/NexusProtectedHeader";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

interface PDVItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export default function PDV() {
  const { profile } = useAuth();
  const [items] = useState<PDVItem[]>([]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NexusProtectedHeader />
      <div className="p-4 flex-1 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-2">
          <h2 className="font-bold text-lg">PDV - Itens</h2>
          <div className="border rounded p-2 h-[60vh] overflow-auto text-sm">
            {items.length === 0 && <div className="text-muted-foreground">Nenhum item</div>}
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="font-bold text-lg">Totais</h2>
          <div className="border rounded p-2 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>R$ 0,00</span></div>
            <div className="flex justify-between font-bold"><span>Total</span><span>R$ 0,00</span></div>
          </div>
          <div className="text-xs text-muted-foreground">Operador: {profile?.first_name}</div>
        </div>
      </div>
    </div>
  )
}